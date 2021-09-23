import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export const toBN = (value: string): BigNumber => {
  return ethers.utils.parseEther(value);
};

export const fromBN = (value: BigNumber): string => {
  return ethers.utils.formatEther(value);
};

export const frac = (x: BigNumber, n: string, d: string): BigNumber => {
  return x.mul(toBN(n)).div(toBN(d));
};
