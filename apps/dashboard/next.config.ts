import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  bundlePagesRouterDependencies: true,
};

export default nextConfig;
