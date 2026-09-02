import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Images are local files in /public, no remote loaders needed.
  images: { unoptimized: true },
};

export default nextConfig;
