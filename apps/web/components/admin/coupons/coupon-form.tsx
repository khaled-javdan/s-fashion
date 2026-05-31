"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import type { Coupon } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import {
  createCouponAction,
  updateCouponAction,
} from "@/app/[locale]/admin/(authed)/coupons/actions"
import { CouponType } from "@/lib/coupons"
import { aedToFils, filsToAed } from "@/lib/money"
import type { Locale } from "@/lib/locale"

type Props =
  | { mode: "create"; locale: Locale; coupon?: undefined }
  | { mode: "edit"; locale: Locale; coupon: Coupon }

type FormState = {
  code: string
  type: CouponType
  /** PERCENT: whole-number percent; FIXED: AED decimal (converted to fils). */
  value: string
  /** AED decimal → minSubtotalFils. */
  minSubtotalAed: string
  /** AED decimal → maxDiscountFils (PERCENT only). "" = no cap. */
  maxDiscountAed: string
  firstOrderOnly: boolean
  /** "" = unlimited. */
  maxRedemptions: string
  /** "" = unlimited. */
  perCustomerLimit: string
  /** datetime-local string or "". */
  startsAt: string
  expiresAt: string
  isActive: boolean
}

/** A Date → the `datetime-local` input's value (local wall-clock, no seconds). */
function toLocalInput(d: Date | null): string {
  if (!d) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function initialState(coupon?: Coupon): FormState {
  if (!coupon) {
    return {
      code: "",
      type: CouponType.PERCENT,
      value: "",
      minSubtotalAed: "",
      maxDiscountAed: "",
      firstOrderOnly: false,
      maxRedemptions: "",
      perCustomerLimit: "1",
      startsAt: "",
      expiresAt: "",
      isActive: true,
    }
  }
  return {
    code: coupon.code,
    type: coupon.type,
    value:
      coupon.type === CouponType.PERCENT
        ? String(coupon.value)
        : String(filsToAed(coupon.value)),
    minSubtotalAed:
      coupon.minSubtotalFils > 0 ? String(filsToAed(coupon.minSubtotalFils)) : "",
    maxDiscountAed:
      coupon.maxDiscountFils != null
        ? String(filsToAed(coupon.maxDiscountFils))
        : "",
    firstOrderOnly: coupon.firstOrderOnly,
    maxRedemptions:
      coupon.maxRedemptions != null ? String(coupon.maxRedemptions) : "",
    perCustomerLimit:
      coupon.perCustomerLimit != null ? String(coupon.perCustomerLimit) : "",
    startsAt: toLocalInput(coupon.startsAt),
    expiresAt: toLocalInput(coupon.expiresAt),
    isActive: coupon.isActive,
  }
}

/** Empty/blank numeric string → null, else parsed int. */
function intOrNull(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) ? n : null
}

export function CouponForm({ mode, locale, coupon }: Props) {
  const t = useTranslations("admin.coupons")
  const router = useRouter()
  const [state, setState] = useState<FormState>(() => initialState(coupon))
  const [pending, startTransition] = useTransition()

  const isPercent = state.type === CouponType.PERCENT

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  function buildPayload() {
    const rawValue = Number.parseFloat(state.value.trim())
    const value = isPercent
      ? Math.round(Number.isFinite(rawValue) ? rawValue : 0)
      : aedToFils(Number.isFinite(rawValue) ? rawValue : 0)

    const minAed = Number.parseFloat(state.minSubtotalAed.trim())
    const maxAed = Number.parseFloat(state.maxDiscountAed.trim())

    return {
      code: state.code.trim(),
      type: state.type,
      value,
      minSubtotalFils: state.minSubtotalAed.trim()
        ? aedToFils(Number.isFinite(minAed) ? minAed : 0)
        : 0,
      // A discount cap only applies to PERCENT coupons; drop it for FIXED.
      maxDiscountFils:
        isPercent && state.maxDiscountAed.trim()
          ? aedToFils(Number.isFinite(maxAed) ? maxAed : 0)
          : null,
      firstOrderOnly: state.firstOrderOnly,
      maxRedemptions: intOrNull(state.maxRedemptions),
      perCustomerLimit: intOrNull(state.perCustomerLimit),
      startsAt: state.startsAt ? new Date(state.startsAt) : null,
      expiresAt: state.expiresAt ? new Date(state.expiresAt) : null,
      isActive: state.isActive,
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = buildPayload()
    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updateCouponAction(coupon.id, payload)
          : await createCouponAction(payload)
      if (result.ok) {
        toast.success(mode === "edit" ? t("toast.updated") : t("toast.created"))
        router.push(`/${locale}/admin/coupons`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid gap-2">
        <Label htmlFor="coupon-code">{t("form.code")}</Label>
        <Input
          id="coupon-code"
          value={state.code}
          onChange={(e) => set("code", e.target.value)}
          dir="ltr"
          autoCapitalize="characters"
          className="uppercase"
          placeholder={t("form.code_placeholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="coupon-type">{t("form.type")}</Label>
          <Select
            value={state.type}
            onValueChange={(v) => set("type", v as CouponType)}
          >
            <SelectTrigger id="coupon-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CouponType.PERCENT}>
                {t("form.type_percent")}
              </SelectItem>
              <SelectItem value={CouponType.FIXED}>
                {t("form.type_fixed")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="coupon-value">
            {isPercent ? t("form.value_percent") : t("form.value_fixed")}
          </Label>
          <Input
            id="coupon-value"
            type="number"
            inputMode="decimal"
            min={isPercent ? 1 : 0}
            max={isPercent ? 100 : undefined}
            step={isPercent ? 1 : "0.01"}
            value={state.value}
            onChange={(e) => set("value", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="coupon-min">{t("form.min_subtotal")}</Label>
          <Input
            id="coupon-min"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={state.minSubtotalAed}
            onChange={(e) => set("minSubtotalAed", e.target.value)}
            placeholder={t("form.no_minimum")}
          />
        </div>

        {isPercent ? (
          <div className="grid gap-2">
            <Label htmlFor="coupon-cap">{t("form.max_discount")}</Label>
            <Input
              id="coupon-cap"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={state.maxDiscountAed}
              onChange={(e) => set("maxDiscountAed", e.target.value)}
              placeholder={t("form.no_cap")}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="coupon-max-redemptions">
            {t("form.max_redemptions")}
          </Label>
          <Input
            id="coupon-max-redemptions"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={state.maxRedemptions}
            onChange={(e) => set("maxRedemptions", e.target.value)}
            placeholder={t("form.unlimited")}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="coupon-per-customer">
            {t("form.per_customer_limit")}
          </Label>
          <Input
            id="coupon-per-customer"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={state.perCustomerLimit}
            onChange={(e) => set("perCustomerLimit", e.target.value)}
            placeholder={t("form.unlimited")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="coupon-starts">{t("form.starts_at")}</Label>
          <Input
            id="coupon-starts"
            type="datetime-local"
            value={state.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="coupon-expires">{t("form.expires_at")}</Label>
          <Input
            id="coupon-expires"
            type="datetime-local"
            value={state.expiresAt}
            onChange={(e) => set("expiresAt", e.target.value)}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border p-3">
        <span className="text-sm">
          <span className="font-medium">{t("form.first_order_only")}</span>
          <span className="text-muted-foreground block text-xs">
            {t("form.first_order_only_hint")}
          </span>
        </span>
        <Switch
          checked={state.firstOrderOnly}
          onCheckedChange={(v) => set("firstOrderOnly", v === true)}
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border p-3">
        <span className="text-sm font-medium">{t("form.active")}</span>
        <Switch
          checked={state.isActive}
          onCheckedChange={(v) => set("isActive", v === true)}
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {mode === "edit" ? t("form.save") : t("form.create")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${locale}/admin/coupons`)}
        >
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  )
}
