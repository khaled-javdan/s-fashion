/**
 * Client-side image compression.
 *
 * Product images are capped at 1 MB so they upload comfortably under the
 * Server Action body limit and keep the Blob store light. Rather than rejecting
 * a too-large file, we re-encode it in the browser (canvas → WebP, falling back
 * to JPEG where WebP encoding isn't supported) — first dropping quality, then
 * downscaling — until it fits under the target.
 *
 * Browser-only: relies on `createImageBitmap`, `<canvas>`, and `toBlob`.
 */

/** Default size we compress down to (1 MB). */
export const IMAGE_TARGET_BYTES = 1024 * 1024

/**
 * Return a version of `file` no larger than `targetBytes`. Files already at or
 * under the target are returned unchanged. If the image can't be decoded or
 * encoding never beats the original, the original file is returned so the
 * caller can still attempt the upload (or let the server reject it).
 */
export async function compressImageToTarget(
  file: File,
  targetBytes: number = IMAGE_TARGET_BYTES,
): Promise<File> {
  if (file.size <= targetBytes) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Undecodable (corrupt, or a format the browser can't rasterize): leave it
    // to the upload path to handle.
    return file
  }

  try {
    let best: { blob: Blob; type: string } | null = null
    let scale = 1
    let quality = 0.82

    // Each pass lowers quality until a floor, then shrinks dimensions — which
    // guarantees convergence well under any sane target for real photos.
    for (let attempt = 0; attempt < 12; attempt++) {
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const encoded = await drawAndEncode(bitmap, width, height, quality)
      if (!encoded) break
      best = encoded
      if (encoded.blob.size <= targetBytes) break
      if (quality > 0.45) quality -= 0.12
      else scale *= 0.8
    }

    if (best && best.blob.size < file.size) {
      return new File([best.blob], renameForType(file.name, best.type), {
        type: best.type,
        lastModified: file.lastModified,
      })
    }
    return file
  } finally {
    bitmap.close()
  }
}

/** Draw the bitmap at the given size and encode it, preferring WebP. */
async function drawAndEncode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<{ blob: Blob; type: string } | null> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)

  const webp = await toBlob(canvas, "image/webp", quality)
  if (webp) return { blob: webp, type: "image/webp" }
  // Safari < 16.4 and a few others can't encode WebP — fall back to JPEG.
  const jpeg = await toBlob(canvas, "image/jpeg", quality)
  if (jpeg) return { blob: jpeg, type: "image/jpeg" }
  return null
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), type, quality),
  )
}

/** Swap the file extension to match the encoded MIME type. */
function renameForType(name: string, type: string): string {
  const ext = type === "image/webp" ? "webp" : "jpg"
  const base = name.replace(/\.[^./\\]+$/, "")
  return `${base || "image"}.${ext}`
}
