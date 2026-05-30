"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

/**
 * OTP verification step. Renders a 6-digit `input-otp`, auto-submits when all
 * six digits are entered, exposes a "Resend" link gated behind a 60s cooldown,
 * and an "Edit details" button to return to the form.
 */
export function OtpStep({
  phone,
  submitting,
  error,
  onComplete,
  onResend,
  onEdit,
}: {
  phone: string
  submitting: boolean
  error: string | null
  onComplete: (code: string) => void
  onResend: () => Promise<void>
  onEdit: () => void
}) {
  const t = useTranslations("checkout")
  const [code, setCode] = useState("")
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [resending, setResending] = useState(false)
  const lastSubmitted = useRef<string | null>(null)

  // Cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  // Clear the field after a failed verification so the user can retype.
  useEffect(() => {
    if (error) {
      // Reset the field in response to an external verification error.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode("")
      lastSubmitted.current = null
    }
  }, [error])

  function handleChange(value: string) {
    setCode(value)
    if (
      value.length === OTP_LENGTH &&
      !submitting &&
      lastSubmitted.current !== value
    ) {
      lastSubmitted.current = value
      onComplete(value)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      await onResend()
      setCooldown(RESEND_COOLDOWN_SECONDS)
      setCode("")
      lastSubmitted.current = null
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl tracking-wide text-foreground">
          {t("otp_heading")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("otp_helper", { phone })}
        </p>
      </div>

      <div className="flex justify-center" dir="ltr">
        <InputOTP
          maxLength={OTP_LENGTH}
          value={code}
          onChange={handleChange}
          disabled={submitting}
          autoFocus
          inputMode="numeric"
          aria-invalid={!!error}
          aria-label={t("otp_heading")}
        >
          <InputOTPGroup>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <InputOTPSlot key={i} index={i} className="size-12 text-base" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error ? (
        <p className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full"
        disabled={submitting || code.length !== OTP_LENGTH}
        onClick={() => onComplete(code)}
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("verifying")}
          </>
        ) : (
          t("otp_submit")
        )}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onEdit}
          disabled={submitting}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
        >
          {t("edit_details")}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending || submitting}
          className="text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0
            ? t("resend_in", { seconds: cooldown })
            : t("resend_otp")}
        </button>
      </div>
    </div>
  )
}
