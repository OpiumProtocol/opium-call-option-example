pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "opium-contracts/contracts/Lib/LibDerivative.sol";

interface ICore {
    function execute(
        address _tokenOwner,
        uint256 _tokenId,
        uint256 _quantity,
        LibDerivative.Derivative calldata _derivative
    ) external;

    function cancel(
        uint256 _tokenId,
        uint256 _quantity,
        LibDerivative.Derivative calldata _derivative
    ) external;

    function create(
        LibDerivative.Derivative calldata _derivative,
        uint256 _quantity,
        address[2] calldata _addresses
    ) external;

    function getDerivativeHash(LibDerivative.Derivative calldata _derivative)
        external
        pure
        returns (bytes32 derivativeHash);
}
