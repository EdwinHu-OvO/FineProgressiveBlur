import type { NextConfig } from "next";

const staticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: staticExport,
  // Request-dependent handlers use route.server.ts and require a server.
  pageExtensions: [
    "tsx",
    "ts",
    "jsx",
    "js",
    ...(staticExport ? [] : ["server.ts"]),
  ],
  images: { unoptimized: staticExport },
  reactCompiler: true,
};

export default nextConfig;
