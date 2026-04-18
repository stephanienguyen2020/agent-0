import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";

import { opBNBTestnet } from "@/lib/chains";

/** Singleton wagmi config — must match `WagmiProvider` in [`app/providers.tsx`](@/app/providers.tsx). */
export const wagmiConfig = createConfig({
  chains: [opBNBTestnet],
  transports: {
    [opBNBTestnet.id]: http(
      process.env.NEXT_PUBLIC_OPBNB_RPC_URL || "https://opbnb-testnet-rpc.bnbchain.org",
    ),
  },
});
