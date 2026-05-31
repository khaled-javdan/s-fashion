"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import type { OrderStatus } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"

import { setOrderStatusAction } from "@/app/[locale]/admin/(authed)/orders/actions"

type Props = {
  orderId: string
  status: OrderStatus
}

// String literals (not the runtime OrderStatus enum) — importing the enum from
// @workspace/db pulls the Prisma client (node:fs) into the browser bundle.
// PENDING_VERIFICATION is intentionally omitted: it's an internal lifecycle
// state, never a destination an admin sets by hand.
const SETTABLE_STATUSES = [
  "NEW",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "REFUSED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[]

/** The subset of OrderStatus an admin can set (excludes PENDING_VERIFICATION). */
type SettableStatus = (typeof SETTABLE_STATUSES)[number]

// Statuses that warrant an optional "reason" note (cancellations / refusals).
const REASON_STATUSES = new Set<OrderStatus>(["CANCELLED", "REFUSED"])

/**
 * Admin order-status control. A status <Select> + a confirm <Dialog> replaces
 * the old forward-only buttons + window.prompt. Any status can be chosen —
 * including reverting an accidental cancel — and the confirm step takes an
 * optional reason for cancel/refuse. A failed stock re-deduction (reverting a
 * cancel when items sold out) surfaces inline.
 */
export function OrderStatusActions({ orderId, status }: Props) {
  const t = useTranslations("admin.orders")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // The status the admin picked but hasn't confirmed yet (drives the dialog).
  const [target, setTarget] = useState<SettableStatus | null>(null)
  const [reason, setReason] = useState("")

  function openConfirm(next: SettableStatus) {
    if (next === status) return
    setError(null)
    setReason("")
    setTarget(next)
  }

  function closeDialog() {
    if (pending) return
    setTarget(null)
  }

  function confirm() {
    if (!target) return
    const to = target
    setError(null)
    startTransition(async () => {
      const result = await setOrderStatusAction({
        orderId,
        to,
        reason: REASON_STATUSES.has(to)
          ? reason.trim() || undefined
          : undefined,
      })
      if (result.ok) {
        setTarget(null)
        router.refresh()
      } else if (result.error === "insufficient_stock") {
        setError(t("actions.insufficient_stock"))
      } else {
        setError(result.error)
      }
    })
  }

  const showReason = target ? REASON_STATUSES.has(target) : false

  return (
    <div className="bg-card text-card-foreground space-y-3 rounded-md border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {t("actions.heading")}
      </h2>

      <div className="grid gap-2">
        <Label htmlFor="order-status-select">{t("actions.set_status")}</Label>
        <Select value={status} onValueChange={(v) => openConfirm(v as SettableStatus)}>
          <SelectTrigger id="order-status-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SETTABLE_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {t("actions.set_status_hint")}
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("actions.confirm_title")}</DialogTitle>
            <DialogDescription>
              {target
                ? t("actions.confirm_body", {
                    from: t(`status.${status}`),
                    to: t(`status.${target}`),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>

          {showReason ? (
            <div className="grid gap-2">
              <Label htmlFor="order-status-reason">
                {t("actions.reason_label")}
              </Label>
              <Textarea
                id="order-status-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("actions.reason_placeholder")}
              />
            </div>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={pending}>
              {t("actions.cancel_dialog")}
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {t("actions.confirm_action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
