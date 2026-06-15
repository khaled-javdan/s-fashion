/**
 * Receives error reports from client-side error boundaries so a browser crash
 * still reaches the team (structured log + throttled Telegram alert), just like
 * a server fault. Fire-and-forget from the client; always returns 204.
 */
import { AppError, reportError } from "@/lib/errors"

type ClientErrorPayload = {
  message?: unknown
  name?: unknown
  stack?: unknown
  componentStack?: unknown
  digest?: unknown
  path?: unknown
  context?: unknown
  userAgent?: unknown
  breadcrumbs?: unknown
  extra?: unknown
}

/** Clamp a value to a short string so a crafted payload can't bloat logs. */
function str(value: unknown, max = 300): string {
  return typeof value === "string" ? value.slice(0, max) : ""
}

/** Clamp an array of strings (e.g. breadcrumbs) to a bounded, short list. */
function strList(value: unknown, maxItems = 30, maxLen = 200): string[] {
  if (!Array.isArray(value)) return []
  return value.slice(-maxItems).map((v) => str(v, maxLen))
}

export async function POST(request: Request): Promise<Response> {
  let body: ClientErrorPayload = {}
  try {
    body = (await request.json()) as ClientErrorPayload
  } catch {
    // Malformed body — nothing to report, but don't surface an error to the client.
    return new Response(null, { status: 204 })
  }

  const message = str(body.message) || "Client error"
  const context = `client:${str(body.context, 80) || "unknown"}`

  // Forward the full diagnostic surface so the structured log + Telegram alert
  // show *where* and *what* — name + stack pinpoint the throw site, the
  // component stack shows the React subtree, and breadcrumbs show what the user
  // did just before. Stacks are clamped generously (they're the whole point of
  // this report) but still bounded so a crafted payload can't flood the logs.
  reportError(
    context,
    new AppError("client_error", message, { expected: false }),
    {
      name: str(body.name, 120),
      stack: str(body.stack, 6000),
      componentStack: str(body.componentStack, 4000),
      digest: str(body.digest, 120),
      path: str(body.path, 300),
      userAgent: str(body.userAgent, 300),
      breadcrumbs: strList(body.breadcrumbs),
      extra:
        body.extra && typeof body.extra === "object"
          ? str(JSON.stringify(body.extra), 2000)
          : "",
    },
  )

  return new Response(null, { status: 204 })
}
