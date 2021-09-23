// theirs
import { utils } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
// types and constants
import { zeroAddress } from "./constants";
import { TDerivative } from "../types";
import { toBN } from "./bn";

export const calculatePortfolioId = (tokenIds: number[], tokenRatio: number[]): string => {
  return utils.solidityKeccak256(["uint256[]", "uint256[]"], [tokenIds, tokenRatio]);
};

export const calculateLongTokenId = (derivativeHash: string): BigNumber => {
  return BigNumber.from(utils.solidityKeccak256(["bytes", "string"], [derivativeHash, "LONG"]));
};

export const calculateShortTokenId = (derivativeHash: string): BigNumber => {
  return BigNumber.from(utils.solidityKeccak256(["bytes", "string"], [derivativeHash, "SHORT"]));
};

export const derivativeFactory = (derivative: Partial<TDerivative>): TDerivative => {
  const def = {
    margin: toBN("0"),
    endTime: 0,
    params: [],
    oracleId: zeroAddress,
    token: zeroAddress,
    syntheticId: zeroAddress,
  };

  return {
    ...def,
    ...derivative,
  };
};

export const getDerivativeHash = (derivative: TDerivative): string => {
  return utils.solidityKeccak256(
    ["uint256", "uint256", "uint256[]", "address", "address", "address"],
    [
      derivative.margin,
      derivative.endTime,
      derivative.params,
      derivative.oracleId,
      derivative.token,
      derivative.syntheticId,
    ],
  );
};
