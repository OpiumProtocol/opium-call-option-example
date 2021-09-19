pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

interface IRegistry {
    function getCore() external view returns (address);

    function getTokenSpender() external view returns (address);

    function getSyntheticAggregator() external view returns (address);

    function getOracleAggregator() external view returns (address);
}
