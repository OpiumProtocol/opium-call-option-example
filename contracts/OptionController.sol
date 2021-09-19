pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "opium-contracts/contracts/Lib/LibDerivative.sol";

import "./interfaces/ICore.sol";
import "./interfaces/ISyntheticAggregator.sol";
import "./interfaces/IRegistry.sol";

contract OptionController is LibDerivative {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address tokenSpender;
    ICore core;
    ISyntheticAggregator syntheticAggregator;

    /// @notice Initializes Opium contracts
    /// @dev uses Opium Registry helper functions to get the required Opium contracts
    /// @param _registry address of Opium Registry contract
    constructor(address _registry) public {
        IRegistry registry = IRegistry(_registry);
        syntheticAggregator = ISyntheticAggregator(registry.getSyntheticAggregator());
        core = ICore(registry.getCore());
        tokenSpender = registry.getTokenSpender();
    }

    /// @notice Wrapper around Opium core.create to create a derivative
    /// @dev transfers required margin from msg.sender to tokenSpender
    /// @param _derivative Derivative Instance of derivative
    /// @param _amount uint256 Amount of derivatives to be created
    /// @param _addresses address[2] Addresses of buyer and seller
    function create(
        Derivative memory _derivative,
        uint256 _amount,
        address[2] memory _addresses
    ) public {
        (uint256 buyerMargin, uint256 sellerMargin) = syntheticAggregator.getMargin(
            getDerivativeHash(_derivative),
            _derivative
        );
        uint256 requiredMargin = buyerMargin.add(sellerMargin).mul(_amount);

        IERC20(_derivative.token).transferFrom(msg.sender, address(this), requiredMargin);
        IERC20(_derivative.token).approve(tokenSpender, requiredMargin);
        core.create(_derivative, _amount, _addresses);
    }

    /// @notice Wrapper around Opium core.execute to execute a derivative
    /// @param _tokenId uint256 `tokenId` of position that needs to be executed
    /// @param _amount uint256 Amount of derivatives to be executed
    /// @param _derivative Derivative Instance of derivative
    function execute(
        uint256 _tokenId,
        uint256 _amount,
        Derivative memory _derivative
    ) public {
        core.execute(msg.sender, _tokenId, _amount, _derivative);
    }
}
