import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // DPR photo uploads send up to 8 resized JPEGs (base64) to a Server Action.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
