import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@worldcoin/idkit", "@worldcoin/idkit-core", "@worldcoin/idkit-server"],
  // Monorepo: avoid wrong workspace root when multiple lockfiles exist (see Next.js warning).
  outputFileTracingRoot: path.join(process.cwd(), ".."),
};

export default nextConfig;
