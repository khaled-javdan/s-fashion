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
  experimental: {
    serverActions: {
      // Product image uploads go through a Server Action. The framework's
      // default request body limit is 1 MB, which rejects most images before
      // the action runs. Images are validated to 8 MB client- and server-side,
      // so allow headroom above that for the multipart body.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // Serve AVIF first (30-50% smaller than WebP), then WebP, then original.
    formats: ["image/avif", "image/webp"],
    // Vercel Blob URLs are content-addressed — the URL never changes for the
    // same image, so a long TTL is safe and avoids redundant re-optimizations.
    minimumCacheTTL: 2592000, // 30 days
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Vercel Blob public store — product image uploads.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
}

export default withNextIntl(nextConfig)
