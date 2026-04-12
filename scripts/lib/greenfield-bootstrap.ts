/**
 * Node shims + Greenfield SDK load (CJS) + cosmos helpers patch for tsx.
 * Pattern from Maui Island / BNB Greenfield upload tooling.
 */
import { createRequire } from "module";

export type LoadedGreenfieldSdk = {
  Client: any;
  VisibilityType: any;
  RedundancyType: any;
  Long: any;
};

export function loadGreenfieldSdk(): LoadedGreenfieldSdk {
  (globalThis as unknown as { window?: unknown }).window =
    (globalThis as unknown as { window?: unknown }).window || {};
  (BigInt.prototype as unknown as { toJSON?: () => string }).toJSON = function toJSON() {
    return this.toString();
  };

  const require = createRequire(import.meta.url);
  const sdk = require("@bnb-chain/greenfield-js-sdk");

  for (const [key, mod] of Object.entries(require.cache)) {
    if (
      key.includes("greenfield-cosmos-types") &&
      key.endsWith("helpers.js") &&
      mod &&
      typeof mod === "object" &&
      "exports" in mod
    ) {
      (mod as { exports: { base64FromBytes: (arr: Uint8Array) => string } }).exports.base64FromBytes =
        function base64FromBytes(arr: Uint8Array) {
          return Buffer.from(arr).toString("base64");
        };
    }
  }

  return {
    Client: sdk.Client,
    VisibilityType: sdk.VisibilityType,
    RedundancyType: sdk.RedundancyType,
    Long: sdk.Long,
  };
}

export async function pickPrimarySp(client: any): Promise<any> {
  const allSps = await client.sp.getStorageProviders();
  const sps = (allSps as any[]).filter(
    (sp: any) => sp.endpoint?.includes("bnbchain") && !sp.endpoint?.includes("nodereal")
  );
  if (sps.length === 0) {
    throw new Error("No storage providers matched filter (bnbchain, not nodereal)");
  }
  return sps[0];
}
