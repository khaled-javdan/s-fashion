"use client"

import Image from "next/image"
import Link from "next/link"
import { Pencil, Star, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import {
  deleteReviewAction,
  toggleReviewFeaturedAction,
  toggleReviewVisibilityAction,
} from "@/app/[locale]/admin/(authed)/reviews/actions"
import {
  ReviewForm,
  type ReviewFormValues,
  type ReviewProductOption,
} from "@/components/admin/reviews/review-form"
import type { Locale } from "@/lib/locale"

export type ReviewRow = ReviewFormValues & {
  productName: string | null
  productSlug: string | null
  isCustomerSubmitted: boolean
}

type Props = {
  reviews: ReviewRow[]
  products: ReviewProductOption[]
  locale: Locale
}

/** Compact, non-fractional star readout for the table cell. */
function RowStars({ value }: { value: number }) {
  return (
    <span className="inline-flex" dir="ltr" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3.5",
            value >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  )
}

export function ReviewsTable({ reviews, products, locale }: Props) {
  const t = useTranslations("admin.reviews")

  if (reviews.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground text-sm">{t("list.empty")}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">{t("table.image")}</TableHead>
            <TableHead>{t("table.author")}</TableHead>
            <TableHead className="w-28">{t("table.rating")}</TableHead>
            <TableHead>{t("table.product")}</TableHead>
            <TableHead className="w-24 text-center">{t("table.featured")}</TableHead>
            <TableHead className="w-24 text-center">{t("table.visible")}</TableHead>
            <TableHead className="w-28 text-end">{t("table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((r) => (
            <Row key={r.id} review={r} products={products} locale={locale} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Row({
  review,
  products,
  locale,
}: {
  review: ReviewRow
  products: ReviewProductOption[]
  locale: Locale
}) {
  const t = useTranslations("admin.reviews")
  const tCommon = useTranslations("common")
  const [featured, setFeatured] = useState(review.featured)
  const [isVisible, setIsVisible] = useState(review.isVisible)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const onToggleFeatured = () => {
    startTransition(async () => {
      const res = await toggleReviewFeaturedAction(review.id)
      if (res.ok) setFeatured(res.data.featured)
      else toast.error(res.error)
    })
  }

  const onToggleVisible = () => {
    startTransition(async () => {
      const res = await toggleReviewVisibilityAction(review.id)
      if (res.ok) setIsVisible(res.data.isVisible)
      else toast.error(res.error)
    })
  }

  const onConfirmDelete = () => {
    startTransition(async () => {
      const res = await deleteReviewAction(review.id)
      if (res.ok) {
        setConfirmingDelete(false)
        toast.success(t("table.deleted"))
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="bg-muted relative h-11 w-11 overflow-hidden rounded-md">
            {review.imageUrl ? (
              <Image
                src={review.imageUrl}
                alt={review.authorName}
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : null}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{review.authorName}</span>
            {review.isCustomerSubmitted && !isVisible ? (
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                {t("table.pending")}
              </Badge>
            ) : null}
          </div>
          {review.authorHandle ? (
            <div className="text-muted-foreground text-xs" dir="ltr">
              {review.authorHandle}
            </div>
          ) : null}
          {review.body ? (
            <div className="text-muted-foreground line-clamp-1 max-w-xs text-xs">
              {review.body}
            </div>
          ) : null}
        </TableCell>
        <TableCell>
          <RowStars value={review.rating} />
        </TableCell>
        <TableCell>
          {review.productName ? (
            <Link
              href={`/${locale}/products/${review.productSlug}`}
              className="text-sm underline-offset-2 hover:underline"
            >
              {review.productName}
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          {review.source ? (
            <Badge variant="outline" className="ms-2 text-[10px] capitalize">
              {review.source}
            </Badge>
          ) : null}
        </TableCell>
        <TableCell className="text-center">
          <Switch
            checked={featured}
            onCheckedChange={onToggleFeatured}
            disabled={pending}
            aria-label={t("table.featured")}
          />
        </TableCell>
        <TableCell className="text-center">
          <Switch
            checked={isVisible}
            onCheckedChange={onToggleVisible}
            disabled={pending}
            aria-label={t("table.visible")}
          />
        </TableCell>
        <TableCell className="text-end">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setEditing((v) => !v)}
              aria-label={t("table.edit")}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              aria-label={t("table.delete")}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {editing ? (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            <ReviewForm
              locale={locale}
              products={products}
              initial={{
                id: review.id,
                rating: review.rating,
                authorName: review.authorName,
                authorHandle: review.authorHandle,
                body: review.body,
                source: review.source,
                productId: review.productId,
                imageUrl: review.imageUrl,
                featured,
                isVisible,
                displayDate: review.displayDate,
                sortOrder: review.sortOrder,
              }}
              onDone={() => setEditing(false)}
            />
          </TableCell>
        </TableRow>
      ) : null}

      <Dialog
        open={confirmingDelete}
        onOpenChange={(open) => {
          if (pending) return
          setConfirmingDelete(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("table.confirm_delete")}</DialogTitle>
            <DialogDescription>
              {t("table.confirm_delete_body")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={pending}
            >
              {t("table.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
