// theirs
import { deployments, ethers } from "hardhat";
import { expect } from "chai";
// utils
import {
  derivativeFactory,
  calculateLongTokenId,
  calculateShortTokenId,
  getDerivativeHash,
} from "../utils/derivatives";
import { timeTravel } from "../utils/hardhat";
import { frac, fromBN, toBN } from "../utils/bn";
// types and constants
import { TDerivativeOrder, TNamedSigners } from "../types";
import {
  ICore,
  OptionCallSyntheticIdMock,
  OptionController,
  TestToken,
  ITokenMinter,
  AdminOracleController,
} from "../typechain";
import { opiumAddresses, SECONDS_40_MINS } from "../utils/constants";

describe("ETH Call Option example with TEST token as a collateral and strike price greater than market price at expiry", () => {
  let testToken: TestToken,
    optionController: OptionController,
    adminOracleController: AdminOracleController,
    optionCallMock: OptionCallSyntheticIdMock,
    tokenMinter: ITokenMinter,
    core: ICore;

  let fullMarginOption: TDerivativeOrder;

  let namedSigners: TNamedSigners;

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
    const testTokenInstance = await deployments.get("TestToken");
    testToken = <TestToken>await ethers.getContractAt("TestToken", testTokenInstance.address);
    const optionCallInstance = await deployments.get("OptionCallSyntheticIdMock");
    optionCallMock = <OptionCallSyntheticIdMock>(
      await ethers.getContractAt("OptionCallSyntheticIdMock", optionCallInstance.address)
    );

    /**
     * @dev initializes Opium Protocol's TokenMinter and Core contracts using its mainnet address
     */
    tokenMinter = <ITokenMinter>await ethers.getContractAt("ITokenMinter", opiumAddresses.tokenMinter);
    core = <ICore>await ethers.getContractAt("ICore", opiumAddresses.core);

    /**
     * @dev definition of the derivative recipe
     */
    const derivative = derivativeFactory({
      margin: toBN("30"), // required collateral denominated in TEST token
      endTime: ~~(Date.now() / 1000) + SECONDS_40_MINS, // Now + 40 mins
      params: [
        toBN("3130"), // Strike Price 3130DAI
      ],
      oracleId: adminOracleController.address,
      token: testToken.address,
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
      amount: 8,
      price: toBN("3390"), // hardcoded market price at expiry 3390DAI
      hash,
      longTokenId,
      shortTokenId,
    };
  });

  it("sets the current derivative and should return a matching derivative hash", async () => {
    await optionController.setDerivative(fullMarginOption.derivative);
    const derivativeHash = await optionController["getDerivativeHash()"]();
    expect(derivativeHash).to.be.eq(getDerivativeHash(fullMarginOption.derivative));
  });

  it("should successfully create a full margin option", async () => {
    const { deployer, seller, buyer } = namedSigners;

    /**
     * @dev approves an amount of DAI equal to the specified margin * amount of derivatives being minted
     * @dev the allowance will be moved to the Opium tokenSpender contract via the optionController contract
     */
    await testToken
      .connect(deployer)
      .approve(optionController.address, fullMarginOption.derivative.margin.mul(fullMarginOption.amount));
    await optionController.connect(deployer).create(fullMarginOption.amount, [buyer.address, seller.address]);

    const buyerPositionsBalance = await tokenMinter["balanceOf(address)"](buyer.address);
    const buyerPositionsLongBalance = await tokenMinter["balanceOf(address,uint256)"](
      buyer.address,
      fullMarginOption.longTokenId,
    );
    const buyerPositionsShortBalance = await tokenMinter["balanceOf(address,uint256)"](
      buyer.address,
      fullMarginOption.shortTokenId,
    );
    const sellerPositionsBalance = await tokenMinter["balanceOf(address)"](seller.address);
    const sellerPositionsLongBalance = await tokenMinter["balanceOf(address,uint256)"](
      seller.address,
      fullMarginOption.longTokenId,
    );
    const sellerPositionsShortBalance = await tokenMinter["balanceOf(address,uint256)"](
      seller.address,
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

  it("should execute the full margin option with the underlying's market price greater or equal than the strike price", async () => {
    const { seller, buyer, oracle, deployer } = namedSigners;

    /**
     * @dev time-travel after the maturity of the derivative
     */
    await timeTravel(SECONDS_40_MINS + 10220);
    await adminOracleController.connect(oracle).__callback(fullMarginOption.derivative.endTime, fullMarginOption.price);

    /**
     * @dev seller and buyer approve the execution of the derivative from a third-party (optionController)
     */
    await optionCallMock.connect(seller).allowThirdpartyExecution(true);
    await optionCallMock.connect(buyer).allowThirdpartyExecution(true);

    const buyerBalanceBefore = await testToken.balanceOf(buyer.address);
    const sellerBalanceBefore = await testToken.balanceOf(seller.address);

    /**
     * @dev calculates the buyer/seller payout for a given underlying's market price
     */
    const [buyerPayout, sellerPayout] = await optionCallMock.getExecutionPayout(
      fullMarginOption.derivative,
      fullMarginOption.price,
    );

    const deployerBalanceBefore = await testToken.balanceOf(deployer.address);

    /**
     * @dev buyer and seller execute their LONG/SHORT positions
     */
    await optionController.connect(buyer).executeLong(fullMarginOption.amount);
    await optionController.connect(seller).executeShort(fullMarginOption.amount);

    const buyerBalanceAfter = await testToken.balanceOf(buyer.address);
    const sellerBalanceAfter = await testToken.balanceOf(seller.address);

    /**
     * if specified, the derivative author takes a commission for creating the derivative
     * the commission is taken from the winning party's payout
     *
     */
    const derivativeAuthorFee = frac(buyerBalanceBefore.add(buyerPayout.mul(fullMarginOption.amount)), "0.25", "100");
    // fee * OPIUM_COMMISSION_PART / OPIUM_COMMISSION_BASE
    const opiumFee = frac(derivativeAuthorFee, "1", "10");
    await core.withdrawFee(fullMarginOption.derivative.token);

    const deployerBalanceAfter = await testToken.balanceOf(deployer.address);
    /**
     * @dev underlying's market price is equal to the strike price so the buyer receives the calculated payout
     */
    expect(buyerPayout.mul(fullMarginOption.amount), "wrong buyer payout").to.be.equal(
      fullMarginOption.derivative.margin.mul(fullMarginOption.amount),
    );
    expect(sellerPayout, "wrong seller payout").to.be.equal(0);
    expect(sellerBalanceAfter, "wrong seller balance").to.be.equal(
      sellerBalanceBefore.add(sellerPayout.mul(fullMarginOption.amount)),
    );
    expect(buyerBalanceAfter, "wrong buyer balance").to.be.equal(
      buyerBalanceBefore.add(buyerPayout.mul(fullMarginOption.amount)).sub(derivativeAuthorFee),
    );
    expect(deployerBalanceAfter, "wrong author balance").to.be.equal(
      deployerBalanceBefore.add(derivativeAuthorFee).sub(opiumFee),
    );
  });
});
