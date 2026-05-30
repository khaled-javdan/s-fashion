"use client"

import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

/**
 * Tab value → status query param. "all" clears the filter. Status values are
 * also OrderStatus enum keys, so labels resolve via the `status.*` namespace;
 * "all" uses a dedicated key.
 */
const TAB_VALUES = [
  "all",
  "NEW",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "REFUSED",
  "CANCELLED",
] as const

export function OrdersStatusTabs({ status }: { status: string }) {
  const t = useTranslations("admin.orders")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const current = TAB_VALUES.some((v) => v === status) ? status : "all"

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") {
      params.delete("status")
    } else {
      params.set("status", value)
    }
    // Any filter change resets pagination.
    params.delete("page")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Tabs value={current} onValueChange={onChange}>
      <TabsList className="flex-wrap">
        {TAB_VALUES.map((value) => (
          <TabsTrigger key={value} value={value}>
            {value === "all" ? t("tabs.all") : t(`status.${value}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
