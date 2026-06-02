"use client"

import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useCallback, useState, type ReactNode } from "react"

import { Tabs } from "@workspace/ui/components/tabs"

/**
 * URL-synced wrapper around the settings {@link Tabs}. The active tab is stored
 * in a `?tab=` query param so a reload (or a shared link) restores it. Tab
 * switches are written with the History API rather than the router, so changing
 * tabs doesn't re-run the server page or refetch settings.
 *
 * The TabsList / TabsContent children are rendered on the server and passed
 * through — they read the active value from this client root's Tabs context.
 */
export function SettingsTabs({
  defaultValue,
  paramKey = "tab",
  children,
}: {
  defaultValue: string
  paramKey?: string
  children: ReactNode
}) {
  const searchParams = useSearchParams()
  // Radix Tabs injects `dir="ltr"` by default, which overrides the page's
  // inherited RTL and forces the tabs/content to lay out left-to-right. Pass
  // the locale direction explicitly so Arabic renders right-to-left.
  const dir = useLocale() === "ar" ? "rtl" : "ltr"
  const [value, setValue] = useState(
    () => searchParams.get(paramKey) ?? defaultValue,
  )

  const handleChange = useCallback(
    (next: string) => {
      setValue(next)
      const params = new URLSearchParams(window.location.search)
      params.set(paramKey, next)
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`,
      )
    },
    [paramKey],
  )

  return (
    <Tabs dir={dir} value={value} onValueChange={handleChange}>
      {children}
    </Tabs>
  )
}
