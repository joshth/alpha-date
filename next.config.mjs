import { realpathSync } from "node:fs"
import { turbopackRoot } from "./lib/turbopack-root.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A symlinked node_modules (e.g. a second checkout sharing one install) must sit inside Turbopack's root.
  turbopack: { root: turbopackRoot(process.cwd(), realpathSync("node_modules")) },
  // PGlite ships WASM + data files that must be loaded from node_modules at
  // runtime rather than bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Import only the icons/charts/animations a page uses, not each whole package.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Lets Swagger UI on the local docs site (pnpm docs:dev) call the API.
      // Development only: production sends no CORS headers.
      ...(process.env.NODE_ENV === "production" ? [] : [{
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "http://localhost:3001" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      }]),
    ]
  },
}

export default nextConfig
