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
  severity?: unknown
  category?: unknown
  extra?: unknown
}

/**
 * Severity is assigned on the client (see `classifyClientError`). The `drop`
 * tier is filtered there and never reaches us, so we only handle the rest.
 * Anything unknown/missing (older clients) defaults to `error` — i.e. it still
 * alerts, preserving the original always-alert behavior.
 */
type Severity = "warn" | "error" | "critical"
function severityOf(value: unknown): Severity {
  return value === "warn" || value === "critical" ? value : "error"
}
const SEVERITY_TITLE: Record<Severity, string> = {
  warn: "🟡 Client warning",
  error: "🟠 Client error",
  critical: "🔴 CRITICAL client error",
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
  const severity = severityOf(body.severity)
  const category = str(body.category, 40) || "unknown"

  // `warn` = the app recovered or the failure was environmental → log only, no
  // alert (mark it `expected`). `error`/`critical` are genuine faults that fire
  // a Telegram alert, with a severity-tagged title and a per-severity+category
  // throttle bucket so a noisy warning can't mute a critical checkout failure.
  reportError(
    context,
    new AppError("client_error", message, { expected: severity === "warn" }),
    {
      name: str(body.name, 120),
      stack: str(body.stack, 6000),
      componentStack: str(body.componentStack, 4000),
      digest: str(body.digest, 120),
      path: str(body.path, 300),
      userAgent: str(body.userAgent, 300),
      severity,
      category,
      breadcrumbs: strList(body.breadcrumbs),
      extra:
        body.extra && typeof body.extra === "object"
          ? str(JSON.stringify(body.extra), 2000)
          : "",
    },
    {
      title: SEVERITY_TITLE[severity],
      throttleKey: `client:${severity}:${category}`,
    },
  )

  return new Response(null, { status: 204 })
}
