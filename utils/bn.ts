import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export const toBN = (value: string): BigNumber => {
  return ethers.utils.parseEther(value);
};

export const fromBN = (value: BigNumber): string => {
  return ethers.utils.formatEther(value);
};

export const cast = (x: number | BigNumber): BigNumber => {
  return BigNumber.from(x);
};
