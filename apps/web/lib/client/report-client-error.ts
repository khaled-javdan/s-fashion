/**
 * Client-safe error reporting → `app/api/client-error/route.ts`.
 *
 * Two entry points:
 *  - {@link reportClientError} — call from a React error boundary with the
 *    caught error (and optional React `componentStack`).
 *  - {@link installGlobalErrorReporting} — wires `window` `error` +
 *    `unhandledrejection` listeners so failures React boundaries *cannot* see
 *    (anything thrown in an event handler, a `setTimeout`, a promise, etc.) are
 *    still reported. The checkout emirate/city `onValueChange` runs in an event
 *    handler, so without this a crash there would never reach the server.
 *
 * All sends are fire-and-forget and fully swallowed — reporting must never throw
 * (especially not inside an error boundary). Browser-only; no server imports.
 */

/** Recent user actions, newest last — attached to every report as context. */
const breadcrumbs: string[] = []
const MAX_BREADCRUMBS = 25

/**
 * Record a short note about what the user just did (e.g.
 * `"checkout:select_emirate DUBAI"`). Kept in a small ring buffer and sent with
 * the next error so we can see the steps that led to a crash.
 */
export function addBreadcrumb(note: string): void {
  try {
    const ts = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
    breadcrumbs.push(`${ts} ${note}`)
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift()
  } catch {
    // Breadcrumbs are best-effort.
  }
}

type ReportableError = {
  message?: string
  name?: string
  stack?: string
  digest?: string
}

/** Pull a usable message/name/stack off whatever was thrown. */
function describe(error: unknown): {
  message: string
  name: string
  stack: string
} {
  if (error instanceof Error) {
    return {
      message: error.message || "Client error",
      name: error.name || "Error",
      stack: error.stack || "",
    }
  }
  if (error && typeof error === "object") {
    const e = error as ReportableError
    return {
      message: e.message || "Client error",
      name: e.name || "Error",
      stack: e.stack || "",
    }
  }
  return { message: String(error ?? "Client error"), name: "Error", stack: "" }
}

/**
 * Forward a caught error to the server. `extra` carries anything diagnostic the
 * call site already has — most importantly the React `componentStack` from an
 * error boundary's `errorInfo`, but also arbitrary state (form values, the
 * selected emirate, etc.).
 */
export function reportClientError(
  context: string,
  error: unknown,
  extra?: { componentStack?: string } & Record<string, unknown>,
): void {
  try {
    const { message, name, stack } = describe(error)
    const digest =
      error && typeof error === "object" && "digest" in error
        ? String((error as ReportableError).digest ?? "")
        : ""

    const { componentStack, ...rest } = extra ?? {}

    const body = JSON.stringify({
      context,
      name,
      message,
      stack,
      componentStack: componentStack ?? "",
      digest,
      // Full URL (path + query) so we can tell which locale/step crashed.
      path:
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "",
      breadcrumbs: breadcrumbs.slice(),
      extra: rest,
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

/**
 * Install one-time global handlers for errors that escape React error
 * boundaries (event handlers, async callbacks, rejected promises). Idempotent —
 * safe to call from every mount of the reporter component.
 */
let installed = false
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === "undefined") return
  installed = true

  window.addEventListener("error", (event) => {
    // `event.error` is the thrown value when available; fall back to the
    // message/filename the browser reports for cross-origin script errors.
    const err =
      event.error ??
      ({
        message: event.message,
        stack: `${event.filename}:${event.lineno}:${event.colno}`,
      } as ReportableError)
    reportClientError("window.onerror", err, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError("unhandledrejection", event.reason)
  })
}
