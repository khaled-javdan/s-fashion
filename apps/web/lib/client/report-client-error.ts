/**
 * Client-safe helper to forward a caught render error to the server so the team
 * is notified (see `app/api/client-error/route.ts`). Fire-and-forget and fully
 * swallowed — reporting must never throw inside an error boundary. Browser-only;
 * carries no server imports.
 */
export function reportClientError(
  context: string,
  error: { message?: string; digest?: string },
): void {
  try {
    const body = JSON.stringify({
      context,
      message: error.message ?? "Client error",
      digest: error.digest ?? "",
      path: typeof window !== "undefined" ? window.location.pathname : "",
    })
    // `keepalive` lets the POST survive a navigation away from the broken page.
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Never let reporting break the boundary's own render.
  }
}
