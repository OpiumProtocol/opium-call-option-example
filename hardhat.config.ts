import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-dependency-compiler";
import "hardhat-gas-reporter";
import "solidity-coverage";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";

import "./tasks/accounts";
import "./tasks/clean";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
  ganache: 1337,
  hardhat: 31337,
  mainnet: 1,
};

const mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

const infuraApiKey = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

const createInfuraUrl = (network: keyof typeof chainIds): string => {
  return "https://" + network + ".infura.io/v3/" + infuraApiKey;
};

const createTestnetConfig = (network: keyof typeof chainIds, nodeUrl: string): NetworkUserConfig => {
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url: nodeUrl,
  };
};

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: true,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      forking: {
        url: createInfuraUrl('mainnet'),
      },
      chainId: chainIds.mainnet,
    },
    ganache: createTestnetConfig("ganache", "http://localhost:8545"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.5.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    buyer: {
      default: 2,
    },
    seller: {
      default: 3,
    },
    oracle: {
      default: 4,
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  mocha: {
    timeout: 20000000,
  },
  dependencyCompiler: {
    paths: [
      "opium-contracts/contracts/Core",
      "opium-contracts/contracts/TokenMinter",
      "opium-contracts/contracts/TokenSpender",
      "opium-contracts/contracts/SyntheticAggregator",
      "opium-contracts/contracts/Registry",
    ],
  },
};

export default config;
