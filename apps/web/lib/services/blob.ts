/**
 * Vercel Blob wrapper.
 *
 * Uploads product images to the project's Blob store under the
 * `products/` prefix, returning a public URL that can be stored on
 * `ProductImage.url`.
 *
 * Env vars (server-only):
 * - BLOB_READ_WRITE_TOKEN  (auto-injected on Vercel when Blob is connected)
 *
 * Must not be imported by client components.
 */
import { put, del } from "@vercel/blob";

export type UploadResult =
  | { ok: true; url: string; pathname: string }
  | { ok: false; error: string };

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: string };

const PRODUCT_PREFIX = "products/";

/**
 * Upload a product image to Vercel Blob with public access.
 * The provided `filename` is normalised and prefixed with `products/`.
 * A random suffix is appended so two uploads with the same filename do
 * not collide.
 */
export async function uploadProductImage(
  file: File | Blob,
  filename: string,
): Promise<UploadResult> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const error = "Vercel Blob is not configured: BLOB_READ_WRITE_TOKEN missing.";
      return { ok: false, error };
    }

    const safeName = sanitizeFilename(filename);
    const pathname = `${PRODUCT_PREFIX}${safeName}`;

    const result = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file instanceof File ? file.type || undefined : undefined,
    });

    return { ok: true, url: result.url, pathname: result.pathname };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload image.";
    console.error("[blob.uploadProductImage]", message);
    return { ok: false, error: message };
  }
}

/**
 * Delete a previously-uploaded product image by its public URL.
 */
export async function deleteProductImage(
  url: string,
): Promise<DeleteResult> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const error = "Vercel Blob is not configured: BLOB_READ_WRITE_TOKEN missing.";
      return { ok: false, error };
    }
    await del(url);
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete image.";
    console.error("[blob.deleteProductImage]", message);
    return { ok: false, error: message };
  }
}

/**
 * Replace unsafe characters in a user-supplied filename. We keep ASCII
 * letters, digits, dot, dash and underscore; everything else becomes "-".
 * Leading slashes and the `products/` prefix are stripped — we add the
 * prefix ourselves above.
 */
function sanitizeFilename(input: string): string {
  const stripped = input.replace(/^\/+/, "").replace(/^products\//, "");
  const cleaned = stripped
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "image";
}
