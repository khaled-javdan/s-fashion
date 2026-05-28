/**
 * In-memory fixed-window rate limiter (token-bucket-ish).
 *
 * Used by the OTP send/check flow to back-pressure abusive clients without
 * paying a round-trip to Redis. The limiter is module-scoped and lives in
 * the function instance's memory.
 *
 * # Cold-start limitation (read me)
 *
 * Vercel functions can scale horizontally and recycle instances at any
 * time, so this limiter:
 *
 *   1. Does NOT share state across function instances. Two simultaneous
 *      requests can land on different instances and each pass the gate.
 *   2. Loses all counters on cold start.
 *
 * For v1 this is intentional — it's a cheap first line of defence. The
 * hard, durable limit is enforced by the `OtpAttempt` table (see
 * `lib/repos/otp-attempts.repo.ts`). Persisted attempts count both
 * successful and failed OTP requests by `phone` and `ip`, and the
 * checkout flow must consult those counts before invoking `sendOtp`.
 *
 * If/when we move to multi-region or need strict global limits, swap this
 * file out for an Upstash/Redis-backed implementation behind the same
 * `tryAcquire` signature.
 */

interface Bucket {
  /** Number of acquisitions made since `windowStart`. */
  count: number;
  /** Epoch millis at which the current window began. */
  windowStart: number;
}

const BUCKETS = new Map<string, Bucket>();

/**
 * Attempt to acquire one token for `key`. Returns true if the call should
 * be allowed, false if the caller has exceeded `max` acquisitions within
 * the rolling `windowMs` window.
 *
 * Recommended `key` shapes:
 *   - `otp:send:phone:+971501234567`
 *   - `otp:send:ip:1.2.3.4`
 *   - `otp:check:phone:+971501234567`
 */
export function tryAcquire(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  if (max <= 0 || windowMs <= 0) return false;
  const now = Date.now();
  const existing = BUCKETS.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    BUCKETS.set(key, { count: 1, windowStart: now });
    pruneIfLarge(now, windowMs);
    return true;
  }

  if (existing.count >= max) {
    return false;
  }

  existing.count += 1;
  return true;
}

/**
 * Test helper / admin escape hatch. Drops all buckets, or only the bucket
 * matching `key` if provided. Not part of the spec'd public API; kept
 * exported so admin tooling can clear stale lockouts in dev.
 */
export function resetRateLimit(key?: string): void {
  if (key === undefined) {
    BUCKETS.clear();
    return;
  }
  BUCKETS.delete(key);
}

/**
 * Prevent the Map from growing unbounded under steady traffic by sweeping
 * any expired buckets when the map gets large. Cheap; only runs at the
 * insertion path.
 */
function pruneIfLarge(now: number, windowMs: number): void {
  if (BUCKETS.size < 1000) return;
  for (const [k, b] of BUCKETS) {
    if (now - b.windowStart >= windowMs) {
      BUCKETS.delete(k);
    }
  }
}
