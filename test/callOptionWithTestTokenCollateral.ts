// theirs
import { deployments, ethers } from "hardhat";
import { expect } from "chai";
// utils
import { derivativeFactory, calculateLongTokenId, calculateShortTokenId } from "../utils/derivatives";
import { timeTravel } from "../utils/hardhat";
import { cast } from "../utils/bn";
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

describe("Call Option example with TEST token as a collateral", () => {
  let testToken: TestToken,
    core: ICore,
    adminOracleController: AdminOracleController,
    tokenMinter: ITokenMinter,
    optionCallMock: OptionCallSyntheticIdMock,
    optionController: OptionController;

  let fullMarginOption: TDerivativeOrder;

  let namedSigners: TNamedSigners;

  before(async () => {
    namedSigners = (await ethers.getNamedSigners()) as TNamedSigners;

    await deployments.fixture(["OpiumControllers"]);
    const optionControllerInstance = await deployments.get("OptionController");
    optionController = <OptionController>(
      await ethers.getContractAt("OptionController", optionControllerInstance.address)
    );
    const adminOracleControllerInstance = await deployments.get("AdminOracleController");
    adminOracleController = <AdminOracleController>(
      await ethers.getContractAt("AdminOracleController", adminOracleControllerInstance.address)
    );

    await deployments.fixture(["Mocks"]);
    const testTokenInstance = await deployments.get("TestToken");
    testToken = <TestToken>await ethers.getContractAt("TestToken", testTokenInstance.address);
    const optionCallInstance = await deployments.get("OptionCallSyntheticIdMock");
    optionCallMock = <OptionCallSyntheticIdMock>(
      await ethers.getContractAt("OptionCallSyntheticIdMock", optionCallInstance.address)
    );

    core = <ICore>await ethers.getContractAt("ICore", opiumAddresses.core);
    tokenMinter = <ITokenMinter>await ethers.getContractAt("ITokenMinter", opiumAddresses.tokenMinter);

    const derivative = derivativeFactory({
      margin: cast(30),
      endTime: ~~(Date.now() / 1000) + SECONDS_40_MINS, // Now + 40 mins
      params: [
        cast(200), // Strike Price
      ],
      oracleId: adminOracleController.address,
      token: testToken.address,
      syntheticId: optionCallMock.address,
    });
    const hash = await core.getDerivativeHash(derivative);
    const longTokenId = calculateLongTokenId(hash);
    const shortTokenId = calculateShortTokenId(hash);
    fullMarginOption = {
      derivative,
      amount: 8,
      price: cast(231), // full margin profit
      hash,
      longTokenId,
      shortTokenId,
    };
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
    await optionController
      .connect(deployer)
      .create(fullMarginOption.derivative, fullMarginOption.amount, [buyer.address, seller.address]);

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

    console.log("sellerPositionsBalance ", sellerPositionsBalance.toString());
    console.log("buyerPositionsBalance ", buyerPositionsBalance.toString());

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
    const { seller, buyer, oracle } = namedSigners;

    /**
     * @dev time-travel after the maturity of the derivative
     */
    await timeTravel(SECONDS_40_MINS * 2);

    await adminOracleController.connect(oracle).__callback(fullMarginOption.derivative.endTime, fullMarginOption.price); // Current price is equal to strike price

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

    /**
     * @dev buyer and seller execute their LONG/SHORT positions
     */
    await optionController
      .connect(seller)
      .execute(fullMarginOption.shortTokenId, fullMarginOption.amount, fullMarginOption.derivative);

    await optionController
      .connect(buyer)
      .execute(fullMarginOption.longTokenId, fullMarginOption.amount, fullMarginOption.derivative);

    const buyerBalanceAfter = await testToken.balanceOf(buyer.address);
    const sellerBalanceAfter = await testToken.balanceOf(seller.address);

    /**
     * @dev underlying's market price is equal to the strike price so the buyer receives the calculated payout
     */
    expect(buyerPayout.mul(fullMarginOption.amount)).to.be.equal(
      fullMarginOption.derivative.margin.mul(fullMarginOption.amount),
    );
    expect(sellerPayout).to.be.equal(0);
    expect(sellerBalanceAfter).to.be.equal(sellerBalanceBefore.add(sellerPayout.mul(fullMarginOption.amount)));
    expect(buyerBalanceAfter).to.be.equal(buyerBalanceBefore.add(buyerPayout.mul(fullMarginOption.amount)));
  });
});
