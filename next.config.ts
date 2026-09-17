import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // DPR photo uploads send up to 8 resized JPEGs (base64) to a Server Action.
    // Quotation file uploads (uploadQuotationFileAction) accept up to 32MB raw,
    // which becomes ~43MB once base64-encoded for the Server Action body — the
    // limit here must stay above that or uploads in the 7.5-32MB range fail
    // with an opaque framework error before reaching the action's own check.
    serverActions: { bodySizeLimit: "45mb" },
  },
};

export default nextConfig;
