import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required so Next.js doesn't bundle PGlite's WASM/data files in local zero-setup mode.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  webpack: (config) => {
    // Allow TypeScript ESM-style ".js" relative imports (used by cursor/identity.ts) to resolve ".ts" files
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
