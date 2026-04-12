/**
 * Deploy contracts to opBNB Testnet after `forge build`.
 * Mirrors docs/03-smart-contracts.md §7.2
 */
import * as fs from "fs";
import * as path from "path";
import { createWalletClient, createPublicClient, http, defineChain, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env") });

const opbnbTestnet = defineChain({
  id: 5611,
  name: "opBNB Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: ["https://opbnb-testnet-rpc.bnbchain.org"] } },
});

function readArtifact(name: string) {
  const p = path.join(__dirname, `../contracts/out/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  const emAgent = process.env.EM_AGENT_ADDRESS as `0x${string}`;
  const treasury = process.env.TREASURY_ADDRESS as `0x${string}`;
  if (!pk || !emAgent || !treasury) throw new Error("Set DEPLOYER_PRIVATE_KEY, EM_AGENT_ADDRESS, TREASURY_ADDRESS");

  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: opbnbTestnet, transport: http() });
  const pub = createPublicClient({ chain: opbnbTestnet, transport: http() });

  const usdcArt = readArtifact("MockUSDC");
  const usdcHash = await wallet.deployContract({
    abi: usdcArt.abi,
    bytecode: usdcArt.bytecode.object as `0x${string}`,
  });
  const usdcAddr = (await pub.waitForTransactionReceipt({ hash: usdcHash })).contractAddress!;
  await wallet.writeContract({
    address: usdcAddr,
    abi: usdcArt.abi,
    functionName: "mint",
    args: [parseUnits("1000000", 6)],
  });

  const repArt = readArtifact("EMReputation");
  const repHash = await wallet.deployContract({
    abi: repArt.abi,
    bytecode: repArt.bytecode.object as `0x${string}`,
    args: [account.address, emAgent],
  });
  const repAddr = (await pub.waitForTransactionReceipt({ hash: repHash })).contractAddress!;

  const arbArt = readArtifact("EMArbitration");
  const arbHash = await wallet.deployContract({
    abi: arbArt.abi,
    bytecode: arbArt.bytecode.object as `0x${string}`,
    args: [account.address, emAgent],
  });
  const arbAddr = (await pub.waitForTransactionReceipt({ hash: arbHash })).contractAddress!;

  const escArt = readArtifact("EMEscrow");
  const escHash = await wallet.deployContract({
    abi: escArt.abi,
    bytecode: escArt.bytecode.object as `0x${string}`,
    args: [usdcAddr, emAgent, treasury, 1300, account.address],
  });
  const escAddr = (await pub.waitForTransactionReceipt({ hash: escHash })).contractAddress!;

  const out = `
MOCK_USDC_ADDRESS=${usdcAddr}
EM_REPUTATION_ADDRESS=${repAddr}
EM_ARBITRATION_ADDRESS=${arbAddr}
EM_ESCROW_ADDRESS=${escAddr}
NEXT_PUBLIC_CHAIN_ID=5611
`;
  fs.writeFileSync(path.join(__dirname, "../.contracts.env"), out.trim() + "\n");
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
