pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "opium-contracts/contracts/Lib/LibDerivative.sol";

interface ISyntheticAggregator {
    function getMargin(bytes32 _derivativeHash, LibDerivative.Derivative calldata _derivative)
        external
        returns (uint256, uint256);
}
