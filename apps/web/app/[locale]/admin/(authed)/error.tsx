"use client"

/**
 * Admin error boundary. Any failure in an authed admin page renders this
 * branded fallback with a retry and the error reference (which also appears in
 * the logs + Telegram alert), instead of Next.js's raw error overlay.
 */
import { useTranslations } from "next-intl"
import { useEffect } from "react"

import { Button } from "@workspace/ui/components/button"

import { reportClientError } from "@/lib/client/report-client-error"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("errors")

  useEffect(() => {
    reportClientError("admin", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold">{t("admin_title")}</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          {t("admin_description")}
        </p>
        <div className="mt-6">
          <Button onClick={reset}>{t("retry")}</Button>
        </div>
        {error.digest ? (
          <p className="text-muted-foreground/70 mt-6 text-xs">
            {t("reference", { id: error.digest })}
          </p>
        ) : null}
      </div>
    </div>
  )
}
