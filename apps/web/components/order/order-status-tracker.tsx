import { Check, Clock, Package, ShoppingBag, Truck, XCircle } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@workspace/ui/lib/utils"

import type { TrackStatus } from "@/components/order/order-tracking-types"

type Props = {
  status: TrackStatus
  createdAt: string
  confirmedAt?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  cancelledAt?: string | null
  locale: "ar" | "en"
}

/** How far along the happy-path the order has progressed (0–3). */
const STATUS_STEP: Record<Exclude<TrackStatus, "CANCELLED" | "REFUSED">, number> =
  {
    PENDING_VERIFICATION: 0,
    AWAITING_PAYMENT: 0,
    NEW: 0,
    CONFIRMED: 1,
    SHIPPED: 2,
    DELIVERED: 3,
  }

function formatDate(iso: string | null | undefined, locale: "ar" | "en") {
  if (!iso) return null
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

/**
 * Localized order-status display. Renders a distinct banner for terminal
 * cancelled/refused states, otherwise a vertical 4-step timeline
 * (received → confirmed → shipped → delivered) with the timestamp under each
 * completed step. Uses `useTranslations`, so it renders in both Server and
 * Client Components.
 */
export function OrderStatusTracker({
  status,
  createdAt,
  confirmedAt,
  shippedAt,
  deliveredAt,
  cancelledAt,
  locale,
}: Props) {
  const tOrder = useTranslations("order")
  const t = useTranslations("tracking")

  if (status === "CANCELLED" || status === "REFUSED") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {tOrder(`status.${status}`)}
            {cancelledAt ? (
              <span className="text-muted-foreground font-normal">
                {" · "}
                {formatDate(cancelledAt, locale)}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {status === "CANCELLED" ? t("cancelled_note") : t("refused_note")}
          </p>
        </div>
      </div>
    )
  }

  const reached = STATUS_STEP[status]
  const steps = [
    { icon: ShoppingBag, label: t("step_placed"), date: createdAt },
    { icon: Check, label: t("step_confirmed"), date: confirmedAt },
    { icon: Truck, label: t("step_shipped"), date: shippedAt },
    { icon: Package, label: t("step_delivered"), date: deliveredAt },
  ]

  return (
    <div className="space-y-1">
      {status === "PENDING_VERIFICATION" || status === "AWAITING_PAYMENT" ? (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {status === "AWAITING_PAYMENT"
              ? t("awaiting_payment_note")
              : t("awaiting_verification_note")}
          </span>
        </div>
      ) : null}

      <ol>
        {steps.map((step, i) => {
          const done = i <= reached
          const current = i === reached
          const isLast = i === steps.length - 1
          const Icon = step.icon
          const dateLabel = formatDate(step.date, locale)
          return (
            <li key={i} className="flex gap-3">
              {/* Icon column with a connector line to the next step. */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                {!isLast ? (
                  <span
                    className={cn(
                      "my-1 w-px flex-1",
                      i < reached ? "bg-primary" : "bg-border",
                    )}
                  />
                ) : null}
              </div>

              <div className={cn("pb-6", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-medium",
                    done ? "text-foreground" : "text-muted-foreground",
                    current && "font-semibold",
                  )}
                >
                  {step.label}
                </p>
                {done && dateLabel ? (
                  <p className="text-xs text-muted-foreground">{dateLabel}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
