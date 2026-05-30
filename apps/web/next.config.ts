import { existsSync } from "node:fs"
import { resolve } from "node:path"

import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

// Monorepo env loading: secrets live at the repo root in `.env.local`, but
// Next.js looks for env files in the app dir (`apps/web/`). Load the root
// file ourselves before Next reads `process.env`.
const repoRootEnv = resolve(__dirname, "../../.env.local")
if (existsSync(repoRootEnv)) {
  process.loadEnvFile(repoRootEnv)
}

const withNextIntl = createNextIntlPlugin("./i18n.ts")

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/db"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Vercel Blob public store — product image uploads.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
}

export default withNextIntl(nextConfig)
