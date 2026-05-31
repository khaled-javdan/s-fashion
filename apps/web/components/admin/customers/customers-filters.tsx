"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import type { Emirate } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import {
  EMIRATE_VALUES,
  formatEmirate,
} from "@/components/admin/orders/emirate"
import type { Locale } from "@/lib/locale"

// Radix Select can't use an empty-string item value, so represent "no filter"
// with this sentinel and translate it to an absent query param.
const ALL = "all"

export function CustomersFilters({
  locale,
  q,
  emirate,
  consentOnly,
  repeatOnly,
}: {
  locale: Locale
  q: string
  emirate?: Emirate
  consentOnly: boolean
  repeatOnly: boolean
}) {
  const t = useTranslations("admin.customers.filters")
  const router = useRouter()
  const [search, setSearch] = useState(q)
  const [emirateValue, setEmirateValue] = useState<string>(emirate ?? ALL)
  const [consent, setConsent] = useState(consentOnly)
  const [repeat, setRepeat] = useState(repeatOnly)

  const base = `/${locale}/admin/customers`

  function apply(event?: React.FormEvent) {
    event?.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    if (emirateValue !== ALL) params.set("emirate", emirateValue)
    if (consent) params.set("consent", "1")
    if (repeat) params.set("segment", "repeat")
    const query = params.toString()
    router.push(query ? `${base}?${query}` : base)
  }

  const hasFilters = q || emirate || consentOnly || repeatOnly

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="customers-q" className="text-xs text-muted-foreground">
          {t("search_label")}
        </Label>
        <Input
          id="customers-q"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_placeholder")}
          className="w-56"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("emirate")}</Label>
        <Select value={emirateValue} onValueChange={setEmirateValue}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("all")}</SelectItem>
            {EMIRATE_VALUES.map((em) => (
              <SelectItem key={em} value={em}>
                {formatEmirate(em)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex h-11 items-center gap-2 text-sm md:h-10">
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
        />
        {t("subscribed_only")}
      </label>

      <label className="flex h-11 items-center gap-2 text-sm md:h-10">
        <Checkbox
          checked={repeat}
          onCheckedChange={(v) => setRepeat(v === true)}
        />
        {t("repeat_buyers")}
      </label>

      <Button type="submit" size="sm" className="h-11 md:h-10">
        {t("apply")}
      </Button>
      {hasFilters ? (
        <Button asChild variant="ghost" size="sm" className="h-11 md:h-10">
          <Link href={base}>{t("clear")}</Link>
        </Button>
      ) : null}
    </form>
  )
}
