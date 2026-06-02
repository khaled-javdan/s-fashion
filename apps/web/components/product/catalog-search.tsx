"use client"

import { Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

/**
 * Inline keyword search on the catalogue page. Commits the query to the shared
 * `?q=` URL param (so searches are shareable and compose with the filter
 * panel), preserving every other active filter. Clearing removes `q` and the
 * implicit relevance sort. Submit-to-navigate — the live autocomplete lives in
 * the header instead.
 */
export function CatalogSearch({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations("products")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [value, setValue] = useState(initialQuery)

  const commit = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) {
      params.set("q", trimmed)
    } else {
      params.delete("q")
      // Drop the relevance sort that only made sense while searching.
      if (params.get("sort") === "relevance") params.delete("sort")
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        commit(value)
      }}
      role="search"
      className="relative"
    >
      <Search
        className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        // `type="text"` (not "search") so the browser's native clear button
        // doesn't duplicate the custom clear button below.
        type="text"
        enterKeyHint="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("search_placeholder")}
        aria-label={t("search_label")}
        className="ps-9 pe-9"
        autoComplete="off"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("search_clear")}
          className="absolute end-1 top-1/2 -translate-y-1/2"
          onClick={() => {
            setValue("")
            commit("")
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </form>
  )
}
