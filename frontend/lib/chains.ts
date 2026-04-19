import { defineChain } from "viem";

const rpc =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_OPBNB_RPC_URL
    ? process.env.NEXT_PUBLIC_OPBNB_RPC_URL
    : "https://opbnb-testnet-rpc.bnbchain.org";

export const opBNBTestnet = defineChain({
  id: 5611,
  name: "opBNB Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
  blockExplorers: {
    default: { name: "opBNBScan", url: "https://testnet.opbnbscan.com" },
  },
});
