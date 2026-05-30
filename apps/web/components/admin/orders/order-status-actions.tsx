"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import type { OrderStatus } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"

import {
  cancelOrder,
  confirmOrder,
  deliverOrder,
  refuseOrder,
  shipOrder,
  type ActionResult,
} from "@/app/[locale]/admin/(authed)/orders/actions"

type Props = {
  orderId: string
  status: OrderStatus
}

// String literals (not the runtime OrderStatus enum) — importing the enum from
// @workspace/db pulls the Prisma client (node:fs) into the browser bundle.
const TERMINAL = new Set<OrderStatus>([
  "DELIVERED",
  "REFUSED",
  "CANCELLED",
])

export function OrderStatusActions({ orderId, status }: Props) {
  const t = useTranslations("admin.orders")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<ActionResult>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function runWithReason(
    action: (input: { orderId: string; reason?: string }) => Promise<ActionResult>,
    promptLabel: string,
  ) {
    const reason = window.prompt(promptLabel) ?? undefined
    // A null prompt (Cancel) aborts; an empty string proceeds without a reason.
    if (reason === undefined) return
    run(() => action({ orderId, reason: reason.trim() || undefined }))
  }

  if (TERMINAL.has(status)) {
    return (
      <div className="bg-card text-card-foreground space-y-2 rounded-md border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("actions.heading")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("actions.final_state")}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card text-card-foreground space-y-3 rounded-md border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {t("actions.heading")}
      </h2>

      <div className="flex flex-wrap gap-2">
        {status === "NEW" ? (
          <>
            <Button
              onClick={() => run(() => confirmOrder({ orderId }))}
              disabled={pending}
            >
              {t("actions.confirm")}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                runWithReason(cancelOrder, t("actions.cancel_reason_prompt"))
              }
              disabled={pending}
            >
              {t("actions.cancel")}
            </Button>
          </>
        ) : null}

        {status === "CONFIRMED" ? (
          <>
            <Button
              onClick={() => run(() => shipOrder({ orderId }))}
              disabled={pending}
            >
              {t("actions.ship")}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                runWithReason(cancelOrder, t("actions.cancel_reason_prompt"))
              }
              disabled={pending}
            >
              {t("actions.cancel")}
            </Button>
          </>
        ) : null}

        {status === "SHIPPED" ? (
          <>
            <Button
              onClick={() => run(() => deliverOrder({ orderId }))}
              disabled={pending}
            >
              {t("actions.mark_delivered")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                runWithReason(refuseOrder, t("actions.refuse_reason_prompt"))
              }
              disabled={pending}
            >
              {t("actions.refused")}
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
