// theirs
import { deployments, ethers } from "hardhat";
import { JsonRpcSigner } from "@ethersproject/providers";
import { expect } from "chai";
// utils
import {
  derivativeFactory,
  calculateLongTokenId,
  calculateShortTokenId,
  getDerivativeHash,
} from "../utils/derivatives";
import { timeTravel, hardhatImpersonateAccount } from "../utils/hardhat";
import { toBN } from "../utils/bn";
// types and constants
import { TDerivativeOrder, TNamedSigners } from "../types";
import { OptionCallSyntheticIdMock, OptionController, ERC20, ITokenMinter, AdminOracleController } from "../typechain";
import { daiAddress, daiRichEOA, opiumAddresses, SECONDS_40_MINS } from "../utils/constants";
import { IERC721O } from "../typechain/IERC721O";

describe("ETH Call Option example with DAI as a collateral and strike price less than market price at expiry", () => {
  let dai: ERC20,
    longToken: IERC721O,
    adminOracleController: AdminOracleController,
    tokenMinter: ITokenMinter,
    optionCallMock: OptionCallSyntheticIdMock,
    optionController: OptionController;

  let fullMarginOption: TDerivativeOrder;

  let namedSigners: TNamedSigners;
  let optionSeller: JsonRpcSigner;

  before(async () => {
    namedSigners = (await ethers.getNamedSigners()) as TNamedSigners;

    /**
     * @dev deploys OptionController and AdminOracleController (see deploy/01_opium_controllers)
     */
    await deployments.fixture(["OpiumControllers"]);
    const optionControllerInstance = await deployments.get("OptionController");
    optionController = <OptionController>(
      await ethers.getContractAt("OptionController", optionControllerInstance.address)
    );
    const adminOracleControllerInstance = await deployments.get("AdminOracleController");
    adminOracleController = <AdminOracleController>(
      await ethers.getContractAt("AdminOracleController", adminOracleControllerInstance.address)
    );

    /**
     * @dev deploys TestToken and OptionCallSyntheticIdMock (see deploy/02_mocks)
     */
    await deployments.fixture(["Mocks"]);
    const optionCallInstance = await deployments.get("OptionCallSyntheticIdMock");
    optionCallMock = <OptionCallSyntheticIdMock>(
      await ethers.getContractAt("OptionCallSyntheticIdMock", optionCallInstance.address)
    );

    /**
     * @dev initializes Opium Protocol's TokenMinter contract using its mainnet address
     */
    tokenMinter = <ITokenMinter>await ethers.getContractAt("ITokenMinter", opiumAddresses.tokenMinter);
    dai = <ERC20>await ethers.getContractAt("ERC20", daiAddress);

    /**
     * @dev definition of the derivative recipe
     */
    const derivative = derivativeFactory({
      margin: toBN("40"), //required collateral denominated in DAI token
      endTime: ~~(Date.now() / 1000) + SECONDS_40_MINS, // Now + 40 mins
      params: [
        toBN("3430"), // Strike Price 3430DAI
      ],
      oracleId: adminOracleController.address,
      token: dai.address,
      syntheticId: optionCallMock.address,
    });
    const hash = getDerivativeHash(derivative);
    const longTokenId = calculateLongTokenId(hash);
    const shortTokenId = calculateShortTokenId(hash);

    /**
     * definition of the order of the previously declared derivative recipe
     */
    fullMarginOption = {
      derivative,
      amount: 10,
      price: toBN("3190"), // hardcoded market price at expiry 3190DAI
      hash,
      longTokenId,
      shortTokenId,
    };

    await hardhatImpersonateAccount(daiRichEOA);
    optionSeller = ethers.provider.getSigner(daiRichEOA);
    const { buyer } = namedSigners;
    await dai.connect(optionSeller).transferFrom(daiRichEOA, buyer.address, 100);
  });

  it("sets the current derivative and should return a matching derivative hash", async () => {
    await optionController.setDerivative(fullMarginOption.derivative);
    const derivativeHash = await optionController["getDerivativeHash()"]();
    expect(derivativeHash).to.be.eq(getDerivativeHash(fullMarginOption.derivative));
  });

  it("should successfully create a full margin option", async () => {
    const { buyer } = namedSigners;

    /**
     * @dev approves an amount of DAI equal to the specified margin * amount of derivatives being minted
     * @dev the allowance will be moved to the Opium tokenSpender contract via the optionController contract
     */
    await dai
      .connect(optionSeller)
      .approve(optionController.address, fullMarginOption.derivative.margin.mul(fullMarginOption.amount));

    /**
     * @dev optionSeller deposits the required collateral and receives a market neutral position (LONG/SHORT)
     */
    await optionController.connect(optionSeller).create(fullMarginOption.amount, [daiRichEOA, daiRichEOA]);
    /**
     * @dev check that the seller has an equal amount of LONG and SHORT positions
     */
    const sellerPositionsLongBalanceMarketNeutral = await tokenMinter["balanceOf(address,uint256)"](
      daiRichEOA,
      fullMarginOption.longTokenId,
    );
    const sellerPositionsShortBalanceMarketNeutral = await tokenMinter["balanceOf(address,uint256)"](
      daiRichEOA,
      fullMarginOption.shortTokenId,
    );
    expect(sellerPositionsLongBalanceMarketNeutral, "wrong seller market neutral position").to.be.eq(
      sellerPositionsShortBalanceMarketNeutral,
    );
    /**
     * @dev seller sells LONG positions to buyer for 20 DAI
     * NOTICE that this is just a mock workflow and in a real-world codebase we'd have an escrow/matching contract
     */
    const longTokenIdAddress = await tokenMinter.ownerOf(fullMarginOption.longTokenId);
    longToken = <IERC721O>await ethers.getContractAt("IERC721O", longTokenIdAddress);
    await longToken
      .connect(optionSeller)
      .transfer(buyer.address, fullMarginOption.longTokenId, fullMarginOption.amount);
    await dai.connect(buyer).transfer(daiRichEOA, 20);

    const buyerPositionsBalance = await tokenMinter["balanceOf(address)"](buyer.address);
    const buyerPositionsLongBalance = await tokenMinter["balanceOf(address,uint256)"](
      buyer.address,
      fullMarginOption.longTokenId,
    );
    const buyerPositionsShortBalance = await tokenMinter["balanceOf(address,uint256)"](
      buyer.address,
      fullMarginOption.shortTokenId,
    );
    const sellerPositionsBalance = await tokenMinter["balanceOf(address)"](daiRichEOA);
    const sellerPositionsLongBalance = await tokenMinter["balanceOf(address,uint256)"](
      daiRichEOA,
      fullMarginOption.longTokenId,
    );
    const sellerPositionsShortBalance = await tokenMinter["balanceOf(address,uint256)"](
      daiRichEOA,
      fullMarginOption.shortTokenId,
    );

    expect(sellerPositionsBalance).to.be.eq(1);
    expect(buyerPositionsBalance).to.be.eq(1);

    /**
     * @dev buyer is minted an amount of erc721o longTokenId equal to the amount of derivatives minted
     */
    expect(buyerPositionsLongBalance).to.be.eq(fullMarginOption.amount);
    expect(buyerPositionsShortBalance).to.be.eq(0);
    /**
     * @dev seller is minted an amount of erc721o shortTokenId equal to the amount of derivatives minted
     */
    expect(sellerPositionsShortBalance).to.be.eq(fullMarginOption.amount);
    expect(sellerPositionsLongBalance).to.be.eq(0);
  });

  it("should execute the full margin option with the underlying's market price less than the strike price", async () => {
    const { buyer, oracle } = namedSigners;

    /**
     * @dev time-travel after the maturity of the derivative
     */
    await timeTravel(SECONDS_40_MINS + 100);
    /**
     * @dev manually pushes the current underlying's market price to the oracle contract
     */
    await adminOracleController.connect(oracle).__callback(fullMarginOption.derivative.endTime, fullMarginOption.price);

    /**
     * @dev seller and buyer approve the execution of the derivative from a third-party (optionController)
     */
    await optionCallMock.connect(optionSeller).allowThirdpartyExecution(true);
    await optionCallMock.connect(buyer).allowThirdpartyExecution(true);

    const buyerBalanceBefore = await dai.balanceOf(buyer.address);
    const sellerBalanceBefore = await dai.balanceOf(daiRichEOA);

    /**
     * @dev calculates the buyer/seller payout for a given underlying's market price
     */
    const [buyerPayout, sellerPayout] = await optionCallMock.getExecutionPayout(
      fullMarginOption.derivative,
      fullMarginOption.price,
    );

    /**
     * @dev buyer and seller execute their LONG/SHORT positions
     */
    await optionController.connect(optionSeller).executeShort(fullMarginOption.amount);
    await optionController.connect(buyer).executeLong(fullMarginOption.amount);

    const buyerBalanceAfter = await dai.balanceOf(buyer.address);
    const sellerBalanceAfter = await dai.balanceOf(daiRichEOA);

    /**
     * @dev underlying's market price is less than the strike price so the seller receives the calculated payout
     */
    expect(buyerPayout, "wrong buyer payout").to.be.equal(0);
    expect(sellerPayout.mul(fullMarginOption.amount), "wrong seller payout").to.be.equal(
      fullMarginOption.derivative.margin.mul(fullMarginOption.amount),
    );
    expect(sellerBalanceAfter, "wrong seller balance").to.be.equal(
      sellerBalanceBefore.add(sellerPayout.mul(fullMarginOption.amount)),
    );
    expect(buyerBalanceAfter, "wrong buyer balance").to.be.equal(
      buyerBalanceBefore.add(buyerPayout.mul(fullMarginOption.amount)),
    );
  });
});
