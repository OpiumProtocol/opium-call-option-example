pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

interface ITokenMinter {
    function approve(address spender, uint256 tokenId) external;

    function balanceOf(address user, uint256 tokenId) external view returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function ownerOf(uint256 _tokenId) external view returns (address);
}
