import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep standalone tracing scoped to this repository, not parent OneDrive projects.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
