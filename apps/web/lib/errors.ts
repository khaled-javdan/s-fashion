/**
 * Central server-side error handling.
 *
 * One place that knows how to:
 *  - **normalize** any thrown value (Prisma errors, Zod errors, our own
 *    `AppError`s, domain errors, plain `Error`s) into a stable `{ code, message,
 *    expected }` shape;
 *  - **report** it — structured `console` log at the right severity, plus a
 *    throttled Telegram alert to the team for anything *unexpected* (so the
 *    admin is notified of real faults, not routine validation rejections);
 *  - hand server actions a **friendly message** to return to the client.
 *
 * Server-only: it imports the Prisma namespace and the Telegram service. Never
 * import this from a client component — use `lib/client/report-client-error.ts`
 * on the client instead.
 */
import { Prisma } from "@workspace/db"

import { sendAdminAlert } from "@/lib/services/telegram"

/** A deliberate, typed application error with a stable machine code. */
export class AppError extends Error {
  readonly code: string
  /** Expected = a routine, user-facing condition (no admin alert). */
  readonly expected: boolean

  constructor(
    code: string,
    message: string,
    options?: { expected?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = "AppError"
    this.code = code
    this.expected = options?.expected ?? true
  }
}

export type NormalizedError = {
  /** Stable machine code, e.g. "unique_violation", "validation", "unknown". */
  code: string
  /** Human-readable, safe-to-show message (English). */
  message: string
  /**
   * `true` for routine conditions the user caused (validation, duplicate,
   * not-found) — logged at `warn`, no admin alert. `false` for genuine faults
   * (DB down, bug, unhandled throw) — logged at `error` and alerted.
   */
  expected: boolean
}

const GENERIC_MESSAGE = "Something went wrong. Please try again."

/** Map any thrown value into a stable, safe-to-surface shape. */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, expected: err.expected }
  }

  // Zod (duck-typed so we don't import zod here): a ZodError has `issues`.
  if (isZodLike(err)) {
    const first = err.issues[0]
    const path = first?.path?.join(".")
    const message = first
      ? path
        ? `${path}: ${first.message}`
        : first.message
      : "Invalid input."
    return { code: "validation", message, expected: true }
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return normalizePrismaKnown(err)
  }

  // Connection / init / panic / validation: genuine faults, not user-facing.
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    return { code: "database_error", message: GENERIC_MESSAGE, expected: false }
  }

  // Domain errors thrown by repos, matched by class name to avoid import cycles.
  if (err instanceof Error) {
    if (err.name === "InsufficientStockError") {
      return { code: "out_of_stock", message: "One or more items are out of stock.", expected: true }
    }
    if (err.name === "CouponExhaustedError") {
      return { code: "coupon_unavailable", message: "That coupon is no longer available.", expected: true }
    }
  }

  return { code: "unknown", message: GENERIC_MESSAGE, expected: false }
}

function normalizePrismaKnown(
  err: Prisma.PrismaClientKnownRequestError,
): NormalizedError {
  switch (err.code) {
    case "P2002": {
      const target = fieldList(err.meta?.target)
      return {
        code: "unique_violation",
        message: target
          ? `A record with that ${target} already exists.`
          : "A record with those details already exists.",
        expected: true,
      }
    }
    case "P2025":
      return { code: "not_found", message: "That record no longer exists.", expected: true }
    case "P2003":
      return {
        code: "in_use",
        message: "This can't be changed because other records depend on it.",
        expected: true,
      }
    case "P2000":
      return { code: "value_too_long", message: "A value is too long.", expected: true }
    default:
      // Unrecognised DB error — treat as a fault worth alerting on.
      return { code: `prisma_${err.code}`, message: GENERIC_MESSAGE, expected: false }
  }
}

function fieldList(target: unknown): string | null {
  if (Array.isArray(target)) return target.join(", ")
  if (typeof target === "string") return target
  return null
}

function isZodLike(
  err: unknown,
): err is { issues: Array<{ path?: (string | number)[]; message: string }> } {
  return (
    !!err &&
    typeof err === "object" &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  )
}

// ─── Reporting ──────────────────────────────────────────────────────────────

/** Throttle admin alerts to one per code per window so a storm can't spam us. */
const ALERT_THROTTLE_MS = 5 * 60 * 1000
const lastAlertAt = new Map<string, number>()

function shortId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid.replace(/-/g, "").slice(0, 8)
  return Math.abs(Date.now() ^ (Math.random() * 1e9)).toString(36).slice(0, 8)
}

/**
 * Log an error and, when it's unexpected, alert the team on Telegram. Returns a
 * short correlation id that can be shown to the user ("ref: a1b2c3") and grepped
 * in the logs / matched against the Telegram alert.
 *
 * `context` should identify the call site, e.g. "createProductAction" or
 * "api/cron/retry-notifications".
 */
export function reportError(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>,
): string {
  const norm = normalizeError(err)
  const id = shortId()
  const tag = `[err:${id}] ${context} code=${norm.code}`

  if (norm.expected) {
    console.warn(tag, extra ?? "", err)
  } else {
    console.error(tag, extra ?? "", err)
    void maybeAlert(id, context, norm, err, extra)
  }

  return id
}

async function maybeAlert(
  id: string,
  context: string,
  norm: NormalizedError,
  err: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const now = Date.now()
  const last = lastAlertAt.get(norm.code) ?? 0
  if (now - last < ALERT_THROTTLE_MS) return
  lastAlertAt.set(norm.code, now)

  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  const lines = [
    `Context: ${context}`,
    `Code: ${norm.code}`,
    `Ref: ${id}`,
    `Detail: ${detail}`,
  ]
  if (extra && Object.keys(extra).length > 0) {
    lines.push(`Extra: ${safeJson(extra)}`)
  }
  try {
    await sendAdminAlert("⚠️ App error", lines)
  } catch {
    // Never let alerting failure mask the original error.
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return "<unserializable>"
  }
}

// ─── Action helper ────────────────────────────────────────────────────────────

/**
 * Report `err` and return a friendly message for a server action's
 * `{ ok: false, error }` result. Unexpected errors get a `(ref: …)` suffix so a
 * customer/admin can quote it for support, and the same id appears in the logs
 * and Telegram alert.
 *
 * Options:
 *  - `extra`  — structured context (e.g. `{ slug, productId }`) forwarded to the
 *    log line and the Telegram alert so the team can see *which* operation failed.
 *  - `diagnostic` — for **trusted (admin-only)** call sites: append the
 *    normalized code and the raw error detail to the returned message so the
 *    admin can see the actual cause inline instead of digging through server
 *    logs. Never set this for customer-facing actions — it would leak internals.
 */
export function toActionError(
  context: string,
  err: unknown,
  options?: { extra?: Record<string, unknown>; diagnostic?: boolean },
): string {
  const norm = normalizeError(err)
  const id = reportError(context, err, options?.extra)
  if (norm.expected) return norm.message

  let message = `${norm.message} (ref: ${id})`
  if (options?.diagnostic) {
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    message += `\n[${norm.code}] ${detail}`
  }
  return message
}
