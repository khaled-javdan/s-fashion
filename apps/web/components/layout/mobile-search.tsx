"use client"

import { Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import { SearchBox } from "@/components/layout/search-box"

/**
 * Mobile-only search entry point: a magnifier icon in the header (next to the
 * cart) that opens a top sheet with an autofocused search field + live
 * suggestions. Desktop uses the inline header `SearchBox` instead, so this is
 * hidden at `md` and up by its header wrapper.
 */
export function MobileSearch() {
  const t = useTranslations("header")
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("search_label")}>
          <Search aria-hidden="true" />
        </Button>
      </SheetTrigger>

      {/* No close button — tapping outside (or picking a result) dismisses it,
          and it would otherwise overlap the search input. */}
      <SheetContent side="top" showCloseButton={false} className="gap-0 p-4">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("search_label")}</SheetTitle>
          <SheetDescription>{t("search_placeholder")}</SheetDescription>
        </SheetHeader>
        <SearchBox autoFocus onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
