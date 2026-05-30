"use client"

import { Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Input } from "@workspace/ui/components/input"

/** Search input that syncs `?q=` (order-number prefix OR phone partial). */
export function OrdersSearch({ q }: { q: string }) {
  const t = useTranslations("admin.orders")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const value = String(formData.get("q") ?? "").trim()

    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("q", value)
    } else {
      params.delete("q")
    }
    params.delete("page")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-xs">
      <Search className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
      <Input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={t("search.placeholder")}
        aria-label={t("search.aria_label")}
        className="ps-9"
      />
    </form>
  )
}
