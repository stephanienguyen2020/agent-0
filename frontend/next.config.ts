import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@worldcoin/idkit", "@worldcoin/idkit-core", "@worldcoin/idkit-server"],
};

export default nextConfig;
