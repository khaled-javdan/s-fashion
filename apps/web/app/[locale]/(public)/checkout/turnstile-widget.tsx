"use client"

/**
 * Cloudflare Turnstile widget (client side of the OTP bot guard).
 *
 * Renders an invisible/managed challenge and hands the resulting token to the
 * parent via an imperative handle. The token is single-use, so the parent must
 * call `reset()` after each `sendOtpAction` so a later resend gets a fresh one.
 *
 * Env-gated to match the server wrapper: when NEXT_PUBLIC_TURNSTILE_SITE_KEY is
 * unset the component renders nothing and `getToken()` returns undefined — the
 * server's verifyTurnstile then skips verification, so local dev keeps working.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react"

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

/** True when a Turnstile site key is configured (challenge is active). */
export const isTurnstileConfigured = Boolean(SITE_KEY)

type TurnstileRenderOptions = {
  sitekey: string
  callback?: (token: string) => void
  "error-callback"?: () => void
  "expired-callback"?: () => void
  "timeout-callback"?: () => void
  appearance?: "always" | "execute" | "interaction-only"
  size?: "normal" | "flexible" | "compact"
  theme?: "auto" | "light" | "dark"
}

type TurnstileApi = {
  render: (el: HTMLElement, opts: TurnstileRenderOptions) => string
  reset: (id?: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export type TurnstileHandle = {
  /** Current solved token, or undefined when unconfigured / not yet solved. */
  getToken: () => string | undefined
  /** Discard the current token and re-run the challenge (tokens are single-use). */
  reset: () => void
}

let scriptPromise: Promise<void> | null = null

/** Load the Turnstile script once, shared across mounts. */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile"]',
    )
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () =>
        reject(new Error("turnstile script failed to load")),
      )
      if (window.turnstile) resolve()
      return
    }
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("turnstile script failed to load"))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export const TurnstileWidget = forwardRef<
  TurnstileHandle,
  { className?: string }
>(function TurnstileWidget({ className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const tokenRef = useRef<string | undefined>(undefined)

  useImperativeHandle(
    ref,
    () => ({
      getToken: () => tokenRef.current,
      reset: () => {
        tokenRef.current = undefined
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current)
        }
      },
    }),
    [],
  )

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (
          cancelled ||
          !containerRef.current ||
          !window.turnstile ||
          widgetIdRef.current
        ) {
          return
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          theme: "auto",
          callback: (token) => {
            tokenRef.current = token
          },
          "expired-callback": () => {
            tokenRef.current = undefined
          },
          "error-callback": () => {
            tokenRef.current = undefined
          },
          "timeout-callback": () => {
            tokenRef.current = undefined
          },
        })
      })
      .catch((err) => {
        console.error("[turnstile-widget] load failed", err)
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [])

  if (!SITE_KEY) return null
  return <div ref={containerRef} className={className} />
})
