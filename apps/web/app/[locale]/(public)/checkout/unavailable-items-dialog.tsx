"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, Check, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import {
  fixFor,
  withCartItems,
  type UnavailableLine,
} from "@/lib/cart-availability"
import { useCartStore } from "@/lib/cart-store"
import type { Locale } from "@/lib/locale"

/**
 * Shown when checkout is refused because one or more lines can no longer be
 * ordered as they stand. It names the exact items — the generic "something is
 * out of stock" toast left customers guessing which one — and offers the fix
 * inline: remove a sold-out line, or keep however many are actually left.
 *
 * The customer stays on the checkout page with their details intact; applying
 * the fixes only touches the cart, so they can place the order straight after.
 */
export function UnavailableItemsDialog({
  lines,
  open,
  onOpenChange,
  onApplied,
  onReviewCart,
}: {
  lines: UnavailableLine[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the cart has been brought in line with what's available. */
  onApplied: () => void
  onReviewCart: () => void
}) {
  const t = useTranslations("checkout.unavailable")
  const locale = useLocale() as Locale

  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.remove)
  const setQuantity = useCartStore((s) => s.setQuantity)

  // Which lines the customer has already dealt with in this dialog. Kept
  // separately from the cart so a handled row stays visible (as a confirmation)
  // instead of vanishing the moment it's fixed.
  const [handled, setHandled] = useState<Record<string, string>>({})

  // Resolved against the cart snapshot taken when the dialog opened, so rows
  // don't disappear as they're fixed.
  const [openedWith] = useState(() => items)
  const rows = useMemo(
    () => withCartItems(lines, openedWith),
    [lines, openedWith],
  )

  function applyOne(line: UnavailableLine) {
    const fix = fixFor(line)
    if (fix.kind === "remove") {
      remove(line.variantId)
      setHandled((prev) => ({ ...prev, [line.variantId]: t("removed") }))
      return
    }
    setQuantity(line.variantId, fix.to)
    setHandled((prev) => ({
      ...prev,
      [line.variantId]: t("updated", { count: fix.to }),
    }))
  }

  const pending = rows.filter((row) => !handled[row.line.variantId])

  function applyAll() {
    for (const row of pending) applyOne(row.line)
    onApplied()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <ul className="-my-1 max-h-[45vh] divide-y divide-border overflow-y-auto">
          {rows.map(({ line, item }) => {
            const name = locale === "ar" ? item.nameAr : item.nameEn
            const colorName =
              locale === "ar" ? item.colorNameAr : item.colorNameEn
            const variantLabel = [colorName, item.size]
              .filter(Boolean)
              .join(" · ")
            const done = handled[line.variantId]
            const keepSome = line.available > 0

            return (
              <li key={line.variantId} className="flex items-center gap-3 py-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={name}
                      fill
                      sizes="56px"
                      className={`object-cover ${done ? "opacity-40" : ""}`}
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {name}
                  </p>
                  {variantLabel ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {variantLabel}
                    </p>
                  ) : null}
                  <p
                    className={`text-xs font-medium ${
                      done ? "text-muted-foreground" : "text-destructive"
                    }`}
                  >
                    {done ??
                      (keepSome
                        ? t("only_left", { count: line.available })
                        : t(
                            line.reason === "discontinued"
                              ? "discontinued"
                              : "sold_out",
                          ))}
                  </p>
                </div>

                {done ? (
                  <Check
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => applyOne(line)}
                  >
                    {keepSome ? (
                      t("keep", { count: line.available })
                    ) : (
                      <>
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        {t("remove")}
                      </>
                    )}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onReviewCart}>
            {t("review_cart")}
          </Button>
          <Button type="button" onClick={applyAll}>
            {pending.length > 0 ? t("apply") : t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
