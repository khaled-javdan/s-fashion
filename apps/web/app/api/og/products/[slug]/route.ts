/**
 * Open Graph preview image for a product.
 *
 * Why this exists: link-preview crawlers (notably WhatsApp) do not reliably
 * render WebP/AVIF `og:image`s, and our stored product photos are often WebP
 * (see `lib/image-compress.ts`). Pointing `og:image` straight at the raw Blob
 * URL therefore produced a preview for some products and a blank card for
 * others. This route fetches the product's first photo and transcodes it to a
 * baseline JPEG that every crawler can render.
 *
 * Output: progressive JPEG, longest side capped at 1200px, alpha flattened onto
 * white. Content-addressed Blob URLs never change, so the response is cached
 * aggressively.
 */
import sharp from "sharp"

import { getProductBySlug } from "@/lib/repos/products.repo"

// sharp is a native module — must run on the Node.js runtime.
export const runtime = "nodejs"

const MAX_DIM = 1200

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  const src = product?.images[0]?.url
  if (!src) return new Response(null, { status: 404 })

  try {
    const upstream = await fetch(src, { cache: "force-cache" })
    if (!upstream.ok) return Response.redirect(src, 302)
    const input = Buffer.from(await upstream.arrayBuffer())

    const jpeg = await sharp(input)
      .rotate() // honour EXIF orientation
      .resize({
        width: MAX_DIM,
        height: MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" }) // drop transparency onto white
      .jpeg({ quality: 82, progressive: true })
      .toBuffer()

    return new Response(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        // Blob URLs are immutable; cache a day in the browser, a week at the edge.
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    })
  } catch {
    // Transcode failed — fall back to the original so non-WhatsApp clients still
    // get something.
    return Response.redirect(src, 302)
  }
}
