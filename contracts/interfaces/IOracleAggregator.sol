pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

interface IOracleAggregator {
    function __callback(uint256 timestamp, uint256 data) external;

    function hasData(address oracleId, uint256 timestamp) external view returns (bool result);
}
