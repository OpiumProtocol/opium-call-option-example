pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "opium-contracts/contracts/Lib/LibDerivative.sol";
import "erc721o/contracts/Libs/LibPosition.sol";

import "./interfaces/ICore.sol";
import "./interfaces/ISyntheticAggregator.sol";
import "./interfaces/IRegistry.sol";

/**
    @notice Wrapper contract to showcase how to interact with the Opium Protocol's Core contract in order to create and execute derivatives' positions
 */

contract OptionController is LibDerivative, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using LibPosition for bytes32;

    address tokenSpender;
    ICore core;
    ISyntheticAggregator syntheticAggregator;

    Derivative public derivative;

    /// @notice Initializes Opium contracts
    /// @dev uses Opium Registry helper functions to get the required Opium contracts
    /// @param _registry address of Opium Registry contract
    constructor(address _registry) public {
        IRegistry registry = IRegistry(_registry);
        syntheticAggregator = ISyntheticAggregator(registry.getSyntheticAggregator());
        core = ICore(registry.getCore());
        tokenSpender = registry.getTokenSpender();
    }

    /// @notice Sets derivative template as a state variable which will be used as a template to create SHORT/LONG positions and execute them in the `create`, `executeShort`, `executeLong` functions
    /// @param _derivative Derivative
    function setDerivative(Derivative memory _derivative) public onlyOwner {
        derivative = _derivative;
    }

    /// @notice Wrapper around LibDerivative getDerivativeHash to return hash of the current derivative for off-chain validation purposes
    /// @return bytes32 of the Derivative derivative hash
    function getDerivativeHash() external view returns (bytes32) {
        return getDerivativeHash(derivative);
    }

    /// @notice Wrapper around Opium core.create to create a derivative
    /// @dev transfers required margin from msg.sender to tokenSpender
    /// @param _amount uint256 Amount of derivatives to be created
    /// @param _addresses address[2] Addresses of buyer(LONG) and seller(SHORT)
    function create(uint256 _amount, address[2] calldata _addresses) external {
        (uint256 buyerMargin, uint256 sellerMargin) = syntheticAggregator.getMargin(
            getDerivativeHash(derivative),
            derivative
        );
        uint256 requiredMargin = _computeMarginRequirement(buyerMargin, sellerMargin, _amount);

        IERC20(derivative.token).transferFrom(msg.sender, address(this), requiredMargin);
        IERC20(derivative.token).approve(tokenSpender, requiredMargin);
        core.create(derivative, _amount, _addresses);
    }

    /// @notice Wrapper around Opium core.execute to execute a derivative SHORT position
    /// @param _amount uint256 Amount of SHORT positions to be executed
    function executeShort(uint256 _amount) external {
        bytes32 derivativeHash = getDerivativeHash(derivative);
        uint256 shortTokenId = derivativeHash.getShortTokenId();
        core.execute(msg.sender, shortTokenId, _amount, derivative);
    }

    /// @notice Wrapper around Opium core.execute to execute a derivative LONG position
    /// @param _amount uint256 Amount of LONG positions to be executed
    function executeLong(uint256 _amount) external {
        bytes32 derivativeHash = getDerivativeHash(derivative);
        uint256 longTokenId = derivativeHash.getLongTokenId();
        core.execute(msg.sender, longTokenId, _amount, derivative);
    }

    /// @notice helper function to calculate the total margin requirement for the creation of a derivative
    /// @param _buyerMargin uint256 margin of the LONG position
    /// @param _sellerMargin uint256 margin of the SHORT position
    /// @param _amount uint256 Amount of derivatives to be created
    function _computeMarginRequirement(
        uint256 _buyerMargin,
        uint256 _sellerMargin,
        uint256 _amount
    ) private pure returns (uint256) {
        return _buyerMargin.add(_sellerMargin).mul(_amount);
    }
}
