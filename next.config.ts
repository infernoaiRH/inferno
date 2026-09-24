import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone for the Docker image (docs/deploy.md). Vercel builds its own.
  output: process.env.VERCEL ? undefined : "standalone",
  // PGlite loads its WebAssembly at runtime; bundled, it fails ("instantiateWasm is not a function").
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
