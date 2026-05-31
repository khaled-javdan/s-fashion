"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import type { Coupon } from "@workspace/db"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { deactivateCouponAction } from "@/app/[locale]/admin/(authed)/coupons/actions"
import { CouponForm } from "@/components/admin/coupons/coupon-form"
import { CouponType } from "@/lib/coupons"
import { formatAed } from "@/lib/money"
import type { Locale } from "@/lib/locale"

export type CouponRow = Coupon & { redeemedCount: number }

type Props = {
  coupons: CouponRow[]
  locale: Locale
}

export function CouponsTable({ coupons, locale }: Props) {
  const t = useTranslations("admin.coupons")
  // null = closed; "new" = create; a Coupon = edit that coupon.
  const [editing, setEditing] = useState<Coupon | "new" | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>{t("list.new")}</Button>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="text-muted-foreground text-sm">{t("list.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.code")}</TableHead>
                <TableHead>{t("table.type")}</TableHead>
                <TableHead className="text-end">{t("table.value")}</TableHead>
                <TableHead className="text-end">{t("table.min_cap")}</TableHead>
                <TableHead className="text-center">
                  {t("table.first_order")}
                </TableHead>
                <TableHead className="text-end">{t("table.limits")}</TableHead>
                <TableHead className="text-end">{t("table.redeemed")}</TableHead>
                <TableHead className="text-center">{t("table.active")}</TableHead>
                <TableHead className="text-end">{t("table.edit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <CouponTableRow
                  key={c.id}
                  coupon={c}
                  locale={locale}
                  onEdit={() => setEditing(c)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl tracking-wide">
              {editing === "new" ? t("form.create_title") : t("form.edit_title")}
            </DialogTitle>
          </DialogHeader>
          {editing === "new" ? (
            <CouponForm mode="create" locale={locale} />
          ) : editing ? (
            <CouponForm mode="edit" locale={locale} coupon={editing} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatDateRange(
  startsAt: Date | null,
  expiresAt: Date | null,
  locale: Locale,
): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d)
  if (!startsAt && !expiresAt) return "—"
  const from = startsAt ? fmt(startsAt) : "…"
  const to = expiresAt ? fmt(expiresAt) : "…"
  return `${from} → ${to}`
}

function CouponTableRow({
  coupon,
  locale,
  onEdit,
}: {
  coupon: CouponRow
  locale: Locale
  onEdit: () => void
}) {
  const t = useTranslations("admin.coupons")
  const router = useRouter()
  const [isActive, setIsActive] = useState(coupon.isActive)
  const [pending, startTransition] = useTransition()

  const onToggle = () => {
    // Activation is edit-only (re-enabling needs the form); the toggle here only
    // soft-disables an active coupon.
    if (!isActive) {
      onEdit()
      return
    }
    startTransition(async () => {
      const result = await deactivateCouponAction(coupon.id)
      if (result.ok) {
        setIsActive(false)
        toast.success(t("toast.deactivated"))
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const valueLabel =
    coupon.type === CouponType.PERCENT
      ? `${coupon.value}%`
      : formatAed(coupon.value, locale)

  const minCapLabel = [
    coupon.minSubtotalFils > 0
      ? t("table.min_value", { value: formatAed(coupon.minSubtotalFils, locale) })
      : null,
    coupon.maxDiscountFils != null
      ? t("table.cap_value", { value: formatAed(coupon.maxDiscountFils, locale) })
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const limitsLabel = [
    coupon.maxRedemptions != null
      ? t("table.global_limit", { count: coupon.maxRedemptions })
      : null,
    coupon.perCustomerLimit != null
      ? t("table.per_customer", { count: coupon.perCustomerLimit })
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <TableRow>
      <TableCell>
        <span className="font-mono font-medium uppercase" dir="ltr">
          {coupon.code}
        </span>
        <span className="text-muted-foreground block text-xs">
          {formatDateRange(coupon.startsAt, coupon.expiresAt, locale)}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {coupon.type === CouponType.PERCENT
            ? t("form.type_percent")
            : t("form.type_fixed")}
        </Badge>
      </TableCell>
      <TableCell className="text-end tabular-nums">{valueLabel}</TableCell>
      <TableCell className="text-muted-foreground text-end text-xs">
        {minCapLabel || "—"}
      </TableCell>
      <TableCell className="text-center">
        {coupon.firstOrderOnly ? (
          <Badge variant="secondary">{t("table.yes")}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-end text-xs">
        {limitsLabel || "—"}
      </TableCell>
      <TableCell className="text-end tabular-nums">
        {coupon.redeemedCount}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={isActive}
          onCheckedChange={onToggle}
          disabled={pending}
          aria-label={t("table.toggle_active")}
        />
      </TableCell>
      <TableCell className="text-end">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t("table.edit")}
        </Button>
      </TableCell>
    </TableRow>
  )
}
