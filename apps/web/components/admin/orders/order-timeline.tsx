import { getTranslations } from "next-intl/server"

import type { OrderEvent, OrderStatus } from "@workspace/db"

import { relativeTime } from "./relative-time"

type StatusChangePayload = {
  from?: string
  to?: string
  reason?: string
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "PENDING_VERIFICATION" ||
    value === "NEW" ||
    value === "CONFIRMED" ||
    value === "SHIPPED" ||
    value === "DELIVERED" ||
    value === "REFUSED" ||
    value === "CANCELLED"
  )
}

type Translator = Awaited<ReturnType<typeof getTranslations>>

function describe(event: OrderEvent, t: Translator): string {
  if (event.type === "status_change") {
    const payload = (event.payload ?? {}) as StatusChangePayload
    const to = isOrderStatus(payload.to) ? t(`status.${payload.to}`) : payload.to
    const from = isOrderStatus(payload.from)
      ? t(`status.${payload.from}`)
      : payload.from
    if (from && to) return t("timeline.transition", { from, to })
    if (to) return t("timeline.set_to", { to })
    return t("timeline.status_changed")
  }
  if (event.type === "note") return t("timeline.note_added")
  if (event.type === "courier_assigned") return t("timeline.courier_assigned")
  return t("timeline.system_event")
}

export async function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const t = await getTranslations("admin.orders")
  const ordered = [...events].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )

  return (
    <div className="bg-card text-card-foreground space-y-4 rounded-md border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {t("timeline.heading")}
      </h2>
      <ol className="space-y-3">
        {ordered.map((event) => {
          const payload = (event.payload ?? {}) as StatusChangePayload
          return (
            <li key={event.id} className="flex items-start gap-3">
              <span
                className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm">{describe(event, t)}</div>
                {payload.reason ? (
                  <div className="text-muted-foreground text-xs">
                    {payload.reason}
                  </div>
                ) : null}
                <div className="text-muted-foreground text-xs">
                  {relativeTime(event.createdAt)}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
