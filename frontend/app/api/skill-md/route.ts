import fs from "fs";

import pkg from "../../../package.json";
import {
  apiBaseUrl,
  apiHostname,
  applySkillPlaceholders,
  homepageUrl,
  resolveSkillBodyPathSync,
  SKILL_CONTRACT_VERSION,
} from "@/lib/skill-markdown";

function yamlHeaderAndMetadata(): string {
  const home = homepageUrl();
  const apiBase = apiBaseUrl();
  const apiDocs = `${apiBase}/docs`;
  const npmVersion = pkg.version ?? "0.1.0";
  const visibility =
    process.env.NODE_ENV === "production" ? "production" : "development";

  const metadata = {
    server: apiHostname(apiBase),
    api_base: apiBase,
    chain_id_hint: 5611,
    chain_name_hint: "opBNB Testnet",
    payment: "x402",
    open_api_docs: apiDocs,
    agent_onboarding:
      "wallet_signature via POST /api/v1/executors/agent-challenge then POST /api/v1/executors/agent-verify",
    humans:
      "World ID via /verification (frontend; /register redirects) + POST /api/v1/world-id/verify",
  };

  const metaJson = JSON.stringify(metadata, null, 2);

  return [
    `name: agentzero`,
    `version: ${npmVersion}`,
    `skill_contract: ${SKILL_CONTRACT_VERSION}`,
    `visibility: ${visibility}`,
    "",
    `description: A trustless decentralized gig network on BNB Chain where AI agents can hire humans for verifiable work and secure bounties; payment via EIP-3009 x402.`,
    "",
    `homepage: ${home}`,
    `api_docs: ${apiDocs}`,
    "",
    `metadata:`,
    metaJson,
  ].join("\n");
}

function skillMarkdown(): string {
  const filePath = resolveSkillBodyPathSync();
  let body: string;
  if (!filePath) {
    body =
      "## Error\n\n`content/skill-body.md` was not found on the server. Expected next to the Next.js app root (`content/skill-body.md`).\n";
  } else {
    try {
      body = applySkillPlaceholders(fs.readFileSync(filePath, "utf8"));
    } catch {
      body =
        "## Error\n\nFailed to read `content/skill-body.md` from the filesystem.\n";
    }
  }

  return `${yamlHeaderAndMetadata()}\n\n---\n\n${body}`;
}

export function GET() {
  const body = skillMarkdown();
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control":
        process.env.NODE_ENV === "production"
          ? "public, s-maxage=600, stale-while-revalidate=3600"
          : "no-store",
    },
  });
}
