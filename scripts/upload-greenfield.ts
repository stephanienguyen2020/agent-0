/**
 * Upload one file to BNB Greenfield testnet; prints a single JSON line to stdout.
 * Logs go to stderr.
 *
 * Usage:
 *   npm run upload-greenfield -- --file ./photo.png --task-id tk_abc --bucket em-evidence-testnet
 *   npm run upload-greenfield -- --file ./meta.json --object-name em-metadata-testnet/agent/foo.json
 *
 * Output stdout: {"url","sha256","txHash","bucket","objectName"}
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import * as dotenv from "dotenv";
import { lookup } from "mime-types";
import { privateKeyToAccount } from "viem/accounts";
import { loadGreenfieldSdk, pickPrimarySp } from "./lib/greenfield-bootstrap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const GREENFIELD_RPC =
  process.env.GREENFIELD_RPC ||
  process.env.GREENFIELD_RPC_URL ||
  "https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org";
const GREENFIELD_CHAIN_ID = process.env.GREENFIELD_CHAIN_ID || "5600";
const DEFAULT_BUCKET = process.env.GREENFIELD_BUCKET || "em-evidence-testnet";

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function printResult(obj: Record<string, string>) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stderr.write(`Usage:
  npm run upload-greenfield -- --file <path> [--task-id <id>] [--object-name <key>] [--bucket <name>]

  If --task-id is set, object key is <task-id>/<basename(file)>.
  Otherwise --object-name is required.
`);
    process.exit(0);
  }

  const filePath = getArg("--file");
  if (!filePath) {
    process.stderr.write("Missing --file\n");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    process.stderr.write(`File not found: ${resolved}\n`);
    process.exit(1);
  }

  const taskId = getArg("--task-id");
  const objectNameArg = getArg("--object-name");
  const bucket = getArg("--bucket") || DEFAULT_BUCKET;

  const base = path.basename(resolved);
  let objectName: string;
  if (objectNameArg) {
    objectName = objectNameArg;
  } else if (taskId) {
    objectName = `${taskId.replace(/^\/+/, "")}/${base}`;
  } else {
    process.stderr.write("Provide --task-id or --object-name\n");
    process.exit(1);
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey?.startsWith("0x")) {
    process.stderr.write("Set DEPLOYER_PRIVATE_KEY in repo root .env\n");
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(resolved);
  const sha256Hex = "0x" + crypto.createHash("sha256").update(fileBuffer).digest("hex");

  const { Client, VisibilityType, RedundancyType, Long } = loadGreenfieldSdk();
  const require = createRequire(import.meta.url);
  const { NodeAdapterReedSolomon } = require("@bnb-chain/reed-solomon/node.adapter");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const address = account.address;

  const client = Client.create(GREENFIELD_RPC, GREENFIELD_CHAIN_ID);
  const rs = new NodeAdapterReedSolomon();
  const primarySp = await pickPrimarySp(client);

  const contentType = lookup(base) || "application/octet-stream";

  process.stderr.write(`Upload ${objectName} (${fileBuffer.length} bytes) → ${bucket}\n`);

  const checksums = await rs.encodeInSubWorker(Uint8Array.from(fileBuffer));

  const createObjectTx = await client.object.createObject({
    bucketName: bucket,
    objectName,
    creator: address,
    visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
    contentType,
    redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
    payloadSize: Long.fromInt(fileBuffer.length),
    expectChecksums: checksums.map((x: string) => Uint8Array.from(Buffer.from(x, "base64"))),
  });

  const simInfo = await createObjectTx.simulate({ denom: "BNB" });
  const broadcastRes = await createObjectTx.broadcast({
    denom: "BNB",
    gasLimit: Number(simInfo.gasLimit),
    gasPrice: simInfo.gasPrice || "5000000000",
    payer: address,
    granter: "",
    privateKey,
  });

  if (broadcastRes.code !== 0) {
    const raw = broadcastRes.rawLog || "";
    if (raw.includes("already exists") || raw.includes("Object already exists")) {
      const publicUrl = `${primarySp.endpoint}/view/${bucket}/${objectName}`;
      printResult({
        url: publicUrl,
        sha256: sha256Hex,
        txHash: broadcastRes.transactionHash || "",
        bucket,
        objectName,
      });
      process.exit(0);
    }
    process.stderr.write(`createObject failed code=${broadcastRes.code} ${raw}\n`);
    process.exit(1);
  }

  const uploadRes = await client.object.uploadObject(
    {
      bucketName: bucket,
      objectName,
      body: {
        name: base,
        type: contentType,
        size: fileBuffer.length,
        content: fileBuffer,
      },
      txnHash: broadcastRes.transactionHash,
    },
    {
      type: "ECDSA",
      privateKey,
    }
  );

  if (uploadRes.code !== 0) {
    process.stderr.write(`uploadObject failed code=${uploadRes.code}\n`);
    process.exit(1);
  }

  const publicUrl = `${primarySp.endpoint}/view/${bucket}/${objectName}`;
  printResult({
    url: publicUrl,
    sha256: sha256Hex,
    txHash: broadcastRes.transactionHash,
    bucket,
    objectName,
  });
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
