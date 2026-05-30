"use client"

import Link from "next/link"
import { Loader2, Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"

import { OrderStatusTracker } from "@/components/order/order-status-tracker"
import type { TrackedOrder } from "@/components/order/order-tracking-types"
import { trackOrderAction } from "@/app/[locale]/(public)/orders/track/actions"
import type { Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"

type Props = {
  locale: Locale
  /** Optional prefill (e.g. from a confirmation-page or email link). */
  defaultOrderNumber?: string
}

export function OrderTrackForm({ locale, defaultOrderNumber = "" }: Props) {
  const t = useTranslations("tracking")
  const [orderNumber, setOrderNumber] = useState(defaultOrderNumber)
  const [phone, setPhone] = useState("")
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<TrackedOrder | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await trackOrderAction({ orderNumber, phone })
      if (res.ok) {
        setResult(res.order)
      } else {
        setResult(null)
        setError(t("not_found"))
      }
    })
  }

  const placedOn = result
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(result.createdAt))
    : null

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="track-order-number">{t("order_number_label")}</Label>
          <Input
            id="track-order-number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder={t("order_number_placeholder")}
            className="font-mono"
            autoComplete="off"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="track-phone">{t("phone_label")}</Label>
          <Input
            id="track-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("phone_placeholder")}
            autoComplete="tel"
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
          {pending ? t("searching") : t("submit")}
        </Button>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-heading text-lg tracking-wide text-foreground">
              {t("result_heading", { orderNumber: result.orderNumber })}
            </h2>
            <span className="text-sm text-muted-foreground">
              {placedOn ? t("placed_on", { date: placedOn }) : null}
            </span>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {t("items_count", { count: result.itemCount })}
            {" · "}
            {t("total")}: {formatAed(result.totalFils, locale)}
          </p>

          <Separator className="my-5" />

          <OrderStatusTracker
            status={result.status}
            createdAt={result.createdAt}
            confirmedAt={result.confirmedAt}
            shippedAt={result.shippedAt}
            deliveredAt={result.deliveredAt}
            cancelledAt={result.cancelledAt}
            locale={locale}
          />

          <Separator className="my-5" />

          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/orders/${result.orderNumber}`}>
              {t("view_details")}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
