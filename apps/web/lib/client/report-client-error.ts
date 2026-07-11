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
 * How much a reported error should actually worry us. Computed at report time
 * from the error's shape + where it happened, so the alert channel can route by
 * criticality instead of treating every `window.onerror` as a page-the-team
 * incident.
 *
 *  - `drop`     — not our code / unactionable (third-party & in-app-browser
 *                 injected scripts, cross-origin "Script error.", extensions).
 *                 Never sent.
 *  - `warn`     — non-fatal: the app recovered (hydration mismatch, a Next
 *                 not-found fallback) or the failure was environmental (network,
 *                 aborted request). Logged, no alert.
 *  - `error`    — a genuine app failure a user hit. Alerted.
 *  - `critical` — conversion-blocking / data-loss (anything on the checkout /
 *                 order / payment path). Alerted loudly, on its own throttle.
 */
export type ClientErrorSeverity = "drop" | "warn" | "error" | "critical"

/**
 * Signatures of code we don't control and can't fix. Matched on message+stack
 * (NOT user-agent) on purpose: a *real* crash from the same Instagram/Facebook
 * in-app browser carries its own app stack and is still reported — only the
 * injected-bridge and cross-origin noise is dropped.
 */
const NOISE_PATTERNS: RegExp[] = [
  /webkit\.messageHandlers/i, // iOS webview native bridge
  /sendDataToNative|sendPageHideMessage/i, // Meta/IG in-app-browser injected handlers
  /iabjs:\/\//i, // Android in-app-browser (Instagram/Facebook) injected navigation logger
  /\bResizeObserver loop\b/i, // benign browser layout notice, never user-visible
  /-extension:\/\//i, // chrome-/moz-/safari-web-extension stacks (user add-ons)
]

/** Non-fatal conditions: the app recovered, or the failure was environmental. */
const WARN_PATTERNS: RegExp[] = [
  // Hydration family — React discards the server HTML for that subtree and
  // re-renders on the client. Cosmetic flicker at worst.
  /Minified React error #(418|419|421|422|423|425)\b/,
  /hydrat/i,
  // Network / aborted requests — not a code bug.
  /\bAbortError\b/,
  /Failed to fetch|NetworkError|Load failed|network ?error/i,
]

/**
 * Classify a client error by severity + a coarse category. Pure and total —
 * must never throw (it runs on the error path).
 */
export function classifyClientError(input: {
  context: string
  message: string
  stack: string
  digest: string
  path: string
}): { severity: ClientErrorSeverity; category: string } {
  const text = `${input.message}\n${input.stack}`

  // 1. Unactionable third-party / cross-origin noise → never report.
  if (
    input.message === "Script error." ||
    NOISE_PATTERNS.some((re) => re.test(text))
  ) {
    return { severity: "drop", category: "third-party" }
  }

  // 2. Anything that reaches us on the checkout/order path is conversion-
  //    blocking — page loudly regardless of the underlying error type.
  if (
    /\/(checkout|order|payment)(\/|\?|$)/.test(input.path) ||
    /checkout|order|payment/i.test(input.context)
  ) {
    return { severity: "critical", category: "checkout" }
  }

  // 3. A Next.js not-found / HTTP fallback thrown during render — app behavior,
  //    not a crash. Keep for trends, don't page.
  if (/NEXT_HTTP_ERROR_FALLBACK/.test(input.digest)) {
    return { severity: "warn", category: "not-found" }
  }

  // 4. Recovered / environmental failures.
  if (WARN_PATTERNS.some((re) => re.test(text))) {
    const category = /react error #41[89]|hydrat/i.test(text)
      ? "hydration"
      : "environmental"
    return { severity: "warn", category }
  }

  // 5. Everything else: a real app error a user actually hit.
  return { severity: "error", category: "app" }
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

    // Full URL (path + query) so we can tell which locale/step crashed.
    const path =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : ""

    // Classify before sending. `drop` (third-party / injected / cross-origin
    // noise) is silently discarded so it never reaches the alert channel; the
    // rest rides to the server tagged with its severity + category.
    const { severity, category } = classifyClientError({
      context,
      message,
      stack,
      digest,
      path,
    })
    if (severity === "drop") return

    const body = JSON.stringify({
      context,
      name,
      message,
      stack,
      componentStack: componentStack ?? "",
      digest,
      path,
      severity,
      category,
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
    // Drop sanitized cross-origin "Script error." events. When a script served
    // from another origin throws, the browser strips the message, stack,
    // filename and line/col (`event.error` is null, message is "Script error.",
    // filename "" and lineno/colno 0) for security. There's nothing to act on —
    // these come from third-party / in-app-browser-injected scripts (Meta
    // Pixel, GTM, Instagram & Facebook webviews) we don't control, so reporting
    // them just spams the alert channel with noise.
    if (!event.error && (!event.filename || event.message === "Script error.")) {
      return
    }
    // `event.error` is the thrown value when available; fall back to the
    // message/filename the browser reports for (same-origin) script errors.
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
