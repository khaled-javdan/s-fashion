"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import {
  ReviewForm,
  type ReviewProductOption,
} from "@/components/admin/reviews/review-form"
import type { Locale } from "@/lib/locale"

/**
 * "Add review" entry point. Opens the create form in a dialog so the reviews
 * table can use the full content width instead of sharing it with an inline
 * sidebar. The form closes the dialog via `onDone` after a successful create.
 */
export function NewReviewDialog({
  locale,
  products,
}: {
  locale: Locale
  products: ReviewProductOption[]
}) {
  const t = useTranslations("admin.reviews")
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("list.new")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl tracking-wide">
              {t("list.new")}
            </DialogTitle>
          </DialogHeader>
          <ReviewForm
            locale={locale}
            products={products}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
