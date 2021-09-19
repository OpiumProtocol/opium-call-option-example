import hre from "hardhat";

export const timeTravel = async (seconds: number): Promise<void> => {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await hre.network.provider.send("evm_mine");
};

export const hardhatImpersonateAccount = async (address: string): Promise<void> => {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
};
