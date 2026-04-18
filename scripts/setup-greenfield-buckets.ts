/**
 * Create Agent Zero buckets on Greenfield testnet (once per environment).
 * Run: npm run setup-greenfield-buckets
 *
 * Requires: DEPLOYER_PRIVATE_KEY, tBNB on Greenfield testnet for gas.
 */
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import {
  loadGreenfieldSdk,
  pickPrimarySp,
} from "./lib/greenfield-bootstrap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const GREENFIELD_RPC =
  process.env.GREENFIELD_RPC ||
  process.env.GREENFIELD_RPC_URL ||
  "https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org";
const GREENFIELD_CHAIN_ID = process.env.GREENFIELD_CHAIN_ID || "5600";

const BUCKETS = [
  { name: "em-evidence-testnet" },
  { name: "em-metadata-testnet" },
  { name: "em-demo-assets" },
];

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey?.startsWith("0x")) {
    console.error("Set DEPLOYER_PRIVATE_KEY in repo root .env");
    process.exit(1);
  }

  const { Client, VisibilityType, Long } = loadGreenfieldSdk();
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const address = account.address;

  console.error(`Account: ${address}`);
  console.error(`RPC: ${GREENFIELD_RPC} chainId=${GREENFIELD_CHAIN_ID}`);

  const client = Client.create(GREENFIELD_RPC, GREENFIELD_CHAIN_ID);
  const primarySp = await pickPrimarySp(client);
  console.error(`Primary SP: ${primarySp.endpoint}`);

  for (const b of BUCKETS) {
    console.error(`\nBucket: ${b.name}`);
    try {
      const createBucketTx = await client.bucket.createBucket({
        bucketName: b.name,
        creator: address,
        visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
        chargedReadQuota: Long.fromString("0"),
        primarySpAddress: primarySp.operatorAddress,
        paymentAddress: address,
      });

      const simulateInfo = await createBucketTx.simulate({ denom: "BNB" });
      const broadcastRes = await createBucketTx.broadcast({
        denom: "BNB",
        gasLimit: Number(simulateInfo.gasLimit),
        gasPrice: simulateInfo.gasPrice || "5000000000",
        payer: address,
        granter: "",
        privateKey,
      });

      if (broadcastRes.code === 0) {
        console.error(`  OK tx=${broadcastRes.transactionHash}`);
      } else {
        console.error(`  code=${broadcastRes.code} log=${broadcastRes.rawLog}`);
        if (broadcastRes.code === 18) {
          console.error("  (likely already exists)");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already") || msg.includes("exist")) {
        console.error("  Already exists, skip.");
      } else {
        console.error(`  Error: ${msg}`);
      }
    }
  }

  console.error("\nDone. Explorer: https://testnet.greenfieldscan.com/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
