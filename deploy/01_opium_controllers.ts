import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { opiumAddresses } from "../utils/constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer, oracle } = await getNamedAccounts();

  await deploy("OptionController", {
    from: deployer,
    args: [opiumAddresses.registry],
    libraries: {
      LibPosition: opiumAddresses.libPosition,
    },
    log: true,
  });

  await deploy("AdminOracleController", {
    from: oracle,
    args: [opiumAddresses.registry],
    log: true,
  });
};

export default func;
func.tags = ["OpiumControllers"];
