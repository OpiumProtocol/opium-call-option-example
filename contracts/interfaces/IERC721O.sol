pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

interface IERC721O {
    function transfer(
        address _to,
        uint256 _tokenId,
        uint256 _amount
    ) external;
}
