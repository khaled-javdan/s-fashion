"use client"

import { Loader2, Search, X } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { Price } from "@/components/currency/price"
import type { Locale } from "@/lib/locale"

/** JSON shape returned by `/api/search` (mirrors `SearchSuggestion`). */
type Suggestion = {
  id: string
  slug: string
  nameEn: string
  nameAr: string
  priceFils: number
  compareAtFils: number | null
  imageUrl: string | null
}

const MIN_CHARS = 2
const DEBOUNCE_MS = 250

/**
 * Header search with a debounced live-suggestions dropdown. Typing fetches the
 * top trigram matches from `/api/search`; Enter (or the "see all" row) navigates
 * to the catalogue page at `/{locale}/products?q=…`, where the full filterable
 * results render. Keyboard navigable (↑/↓/Enter/Esc) and RTL-aware.
 *
 * `onNavigate` lets a host (e.g. the mobile drawer) close itself when the
 * shopper picks a result.
 */
export function SearchBox({
  className,
  autoFocus = false,
  onNavigate,
}: {
  className?: string
  autoFocus?: boolean
  onNavigate?: () => void
}) {
  const t = useTranslations("header")
  const locale = useLocale() as Locale
  const router = useRouter()
  const listId = useId()

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // -1 = the input itself (Enter → all results); 0..n-1 = a suggestion row.
  const [activeIndex, setActiveIndex] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)

  // Debounced fetch. Each keystroke (re)schedules a fetch after the debounce;
  // an AbortController cancels the in-flight request so out-of-order responses
  // can't clobber the latest query. Too-short queries simply schedule nothing —
  // stale results stay in state but are hidden by `showDropdown` below. All
  // state writes happen inside the timer (never synchronously in the effect
  // body) to avoid cascading renders.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_CHARS) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error(`search ${res.status}`)
        const data = (await res.json()) as { results: Suggestion[] }
        setResults(data.results ?? [])
        setOpen(true)
        setActiveIndex(-1)
      } catch {
        // Aborted or failed — leave prior results; never disrupt typing.
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const go = (href: string) => {
    setOpen(false)
    setQuery("")
    setResults([])
    onNavigate?.()
    router.push(href)
  }

  const goToAllResults = () => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_CHARS) return
    go(`/${locale}/products?q=${encodeURIComponent(trimmed)}`)
  }

  const goToProduct = (s: Suggestion) =>
    go(`/${locale}/products/${s.slug}`)

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (results.length === 0) return
      setOpen(true)
      setActiveIndex((i) => (i + 1 >= results.length ? -1 : i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (results.length === 0) return
      setActiveIndex((i) => (i <= -1 ? results.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const active = results[activeIndex]
      if (active) goToProduct(active)
      else goToAllResults()
    } else if (e.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const name = (s: Suggestion) => (locale === "ar" ? s.nameAr : s.nameEn)
  const showDropdown = open && query.trim().length >= MIN_CHARS

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          goToAllResults()
        }}
      >
        <Search
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          // `type="text"` (not "search") so the browser's native clear button
          // doesn't duplicate our custom one. `enterKeyHint` keeps the mobile
          // keyboard's "search" action.
          type="text"
          enterKeyHint="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          placeholder={t("search_placeholder")}
          aria-label={t("search_label")}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className="ps-9 pe-9"
        />
        <span className="absolute end-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2
              className="text-muted-foreground size-4 animate-spin"
              aria-hidden="true"
            />
          ) : query ? (
            <button
              type="button"
              aria-label={t("search_clear")}
              onClick={() => {
                setQuery("")
                setResults([])
                setOpen(false)
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </form>

      {showDropdown ? (
        <div
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-50 mt-2 w-full overflow-hidden rounded-md border border-border shadow-lg"
        >
          {results.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              {loading ? t("search_loading") : t("search_empty")}
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {results.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => goToProduct(s)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-start",
                      i === activeIndex ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="bg-muted relative size-11 shrink-0 overflow-hidden rounded">
                      {s.imageUrl ? (
                        <Image
                          src={s.imageUrl}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {name(s)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        <Price fils={s.priceFils} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              <li role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={goToAllResults}
                  className="text-foreground hover:bg-muted/60 border-border block w-full border-t px-3 py-2.5 text-start text-sm font-medium"
                >
                  {t("search_see_all", { query: query.trim() })}
                </button>
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
