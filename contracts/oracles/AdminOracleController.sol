pragma solidity ^0.5.16;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "opium-contracts/contracts/Interface/IOracleId.sol";

import "../interfaces/IRegistry.sol";
import "../interfaces/IOracleAggregator.sol";

/**
    @notice Wrapper contract to showcase how to push data into the Opium Protocol's OracleAggregator
 */

contract AdminOracleController is IOracleId, Ownable {
    IOracleAggregator oracleAggregator;

    constructor(address _registry) public {
        IRegistry registry = IRegistry(_registry);
        oracleAggregator = IOracleAggregator(registry.getOracleAggregator());
    }

    /// @notice Wrapper around Opium oracleAggregator.__callback to push the data related to the underlying's market price
    /// @dev manually pushes _result from off-chain. In a real-world implementation it could be replaced with an on-chain oracle such as Chainlink as an oracleSubId
    /// @param _timestamp uint256 _timestamp of when the data is being pushed: must be
    /// @param _result uint256 of the market price of the underlying
    function __callback(uint256 _timestamp, uint256 _result) external onlyOwner {
        require(
            !oracleAggregator.hasData(address(this), _timestamp) && _timestamp < now,
            "Only when no data and after timestamp allowed"
        );

        oracleAggregator.__callback(_timestamp, _result);
    }

    function fetchData(uint256 timestamp) external payable {}

    function recursivelyFetchData(
        uint256 timestamp,
        uint256 period,
        uint256 times
    ) external payable {}

    function calculateFetchPrice() external returns (uint256 fetchPrice) {}
}
