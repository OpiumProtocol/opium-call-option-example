import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { BigNumber } from "ethers";
import "hardhat-deploy-ethers";

export interface Signers {
  admin: SignerWithAddress;
}

export type TNamedSigners = {
  deployer: SignerWithAddress;
  governor: SignerWithAddress;
  buyer: SignerWithAddress;
  seller: SignerWithAddress;
  oracle: SignerWithAddress;
};

export type TDerivative = {
  margin: BigNumber;
  endTime: number;
  params: BigNumber[];
  oracleId: string;
  token: string;
  syntheticId: string;
};

export type TDerivativeOrder = {
  derivative: TDerivative;
  amount: number;
  price: BigNumber;
  hash: string;
  longTokenId: BigNumber;
  shortTokenId: BigNumber;
};
