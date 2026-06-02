"use client"

/**
 * Checkout-specific error boundary. Reassures the shopper their cart is intact
 * and nothing was charged, then offers a retry. Reported to the team on mount.
 */
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect } from "react"

import { Button } from "@workspace/ui/components/button"

import { reportClientError } from "@/lib/client/report-client-error"

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("errors")

  useEffect(() => {
    reportClientError("checkout", error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-3xl">{t("checkout_title")}</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        {t("checkout_description")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>{t("retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/cart">{t("back_to_shop")}</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="text-muted-foreground/70 mt-6 text-xs">
          {t("reference", { id: error.digest })}
        </p>
      ) : null}
    </div>
  )
}
