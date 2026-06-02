/**
 * Receives error reports from client-side error boundaries so a browser crash
 * still reaches the team (structured log + throttled Telegram alert), just like
 * a server fault. Fire-and-forget from the client; always returns 204.
 */
import { AppError, reportError } from "@/lib/errors"

type ClientErrorPayload = {
  message?: unknown
  digest?: unknown
  path?: unknown
  context?: unknown
}

/** Clamp a value to a short string so a crafted payload can't bloat logs. */
function str(value: unknown, max = 300): string {
  return typeof value === "string" ? value.slice(0, max) : ""
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

  // `expected: false` so the team is alerted — a client crash is a real fault.
  reportError(context, new AppError("client_error", message, { expected: false }), {
    digest: str(body.digest, 120),
    path: str(body.path, 200),
  })

  return new Response(null, { status: 204 })
}
