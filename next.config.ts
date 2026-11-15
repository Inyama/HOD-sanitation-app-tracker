import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Files read from disk at runtime: serverless hosts (Netlify) only bundle traced files.
  outputFileTracingIncludes: {
    "/**": ["./public/images/HOD-logo.png", "./src/data/sample-sheets/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
