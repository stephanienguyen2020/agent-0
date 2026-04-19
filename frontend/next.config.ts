import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@worldcoin/idkit", "@worldcoin/idkit-core", "@worldcoin/idkit-server"],
  // Monorepo: avoid wrong workspace root when multiple lockfiles exist (see Next.js warning).
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  async redirects() {
    return [{ source: "/skill-md", destination: "/skill.md", permanent: true }];
  },
  async rewrites() {
    return [{ source: "/skill.md", destination: "/api/skill-md" }];
  },
};

export default nextConfig;
