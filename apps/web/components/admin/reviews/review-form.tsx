"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, Star, Upload, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import {
  createReviewAction,
  updateReviewAction,
} from "@/app/[locale]/admin/(authed)/reviews/actions"
import { uploadHeroImageAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import type { Locale } from "@/lib/locale"
import type { ReviewInput } from "@/lib/schemas/review.schema"

/** Minimal product shape for the optional "link to product" selector. */
export type ReviewProductOption = {
  id: string
  slug: string
  nameEn: string
  nameAr: string
}

/** A review pre-loaded for editing (the row's persisted values). */
export type ReviewFormValues = {
  id: string
  rating: number
  authorName: string
  authorHandle: string | null
  body: string | null
  source: string | null
  productId: string | null
  imageUrl: string | null
  featured: boolean
  isVisible: boolean
  displayDate: string | null // yyyy-mm-dd
  sortOrder: number
}

/** Sources we offer as a select (free-form values still allowed in the DB). */
const SOURCES = ["instagram", "tiktok", "google", "whatsapp", "website"] as const

/** Sentinel for "no product" in the Select (empty string isn't a valid value). */
const NO_PRODUCT = "__none__"

type Props = {
  locale: Locale
  products: ReviewProductOption[]
  /** Omit for a create form; pass values to edit an existing review. */
  initial?: ReviewFormValues
  /** Called after a successful create/save (e.g. to close a row editor). */
  onDone?: () => void
}

export function ReviewForm({ locale, products, initial, onDone }: Props) {
  const t = useTranslations("admin.reviews")
  const router = useRouter()
  const mode = initial ? "edit" : "create"

  const [rating, setRating] = useState(initial?.rating ?? 5)
  const [hover, setHover] = useState(0)
  const [authorName, setAuthorName] = useState(initial?.authorName ?? "")
  const [authorHandle, setAuthorHandle] = useState(initial?.authorHandle ?? "")
  const [body, setBody] = useState(initial?.body ?? "")
  const [source, setSource] = useState(initial?.source ?? "")
  const [productId, setProductId] = useState(initial?.productId ?? "")
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "")
  const [featured, setFeatured] = useState(initial?.featured ?? false)
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true)
  const [displayDate, setDisplayDate] = useState(initial?.displayDate ?? "")
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)

  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadHeroImageAction(fd)
      if (res.ok) {
        setImageUrl(res.data.url)
        toast.success(t("form.image_uploaded"))
      } else {
        toast.error(res.error)
      }
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setRating(5)
    setAuthorName("")
    setAuthorHandle("")
    setBody("")
    setSource("")
    setProductId("")
    setImageUrl("")
    setFeatured(false)
    setIsVisible(true)
    setDisplayDate("")
    setSortOrder(0)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!authorName.trim()) {
      toast.error(t("form.error_author_required"))
      return
    }

    const payload: ReviewInput = {
      rating,
      authorName: authorName.trim(),
      authorHandle: authorHandle.trim() || undefined,
      body: body.trim() || undefined,
      source: source || undefined,
      productId: productId || undefined,
      imageUrl: imageUrl || undefined,
      featured,
      isVisible,
      displayDate: displayDate ? new Date(displayDate) : undefined,
      sortOrder,
    }

    startTransition(async () => {
      const res =
        mode === "edit" && initial
          ? await updateReviewAction(initial.id, payload)
          : await createReviewAction(payload)

      if (res.ok) {
        toast.success(mode === "edit" ? t("form.saved") : t("form.created"))
        if (mode === "create") reset()
        router.refresh()
        onDone?.()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <form onSubmit={submit} className="bg-card space-y-4 rounded-md border p-4">
      {/* Star picker */}
      <div className="grid gap-2">
        <Label>{t("form.rating")}</Label>
        <div className="flex items-center gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={t("form.rating_star", { n })}
                aria-pressed={rating === n}
                className="rounded p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "size-6",
                    active
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30",
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="review-author">{t("form.author_name")}</Label>
          <Input
            id="review-author"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={120}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-handle">{t("form.author_handle")}</Label>
          <Input
            id="review-handle"
            dir="ltr"
            value={authorHandle}
            onChange={(e) => setAuthorHandle(e.target.value)}
            maxLength={60}
            placeholder="@handle"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="review-body">{t("form.body")}</Label>
        <Textarea
          id="review-body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder={t("form.body_placeholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("form.source")}</Label>
          <Select
            value={source || NO_PRODUCT}
            onValueChange={(v) => setSource(v === NO_PRODUCT ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("form.source_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PRODUCT}>{t("form.source_none")}</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`source.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>{t("form.product")}</Label>
          <Select
            value={productId || NO_PRODUCT}
            onValueChange={(v) => setProductId(v === NO_PRODUCT ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("form.product_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PRODUCT}>{t("form.product_none")}</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {locale === "ar" ? p.nameAr : p.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Image upload (drives the UGC strip) */}
      <div className="grid gap-2">
        <Label>{t("form.image")}</Label>
        {imageUrl ? (
          <div className="relative aspect-square w-32 overflow-hidden rounded-md border">
            <Image
              src={imageUrl}
              alt={t("form.image_preview_alt")}
              fill
              sizes="128px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              aria-label={t("form.remove_image")}
              className="bg-background/80 hover:bg-background absolute end-1 top-1 rounded-full p-1 shadow transition"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="border-input text-muted-foreground hover:bg-muted flex aspect-square w-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs transition disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span>{uploading ? t("form.uploading") : t("form.upload")}</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ""
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="review-date">{t("form.display_date")}</Label>
          <Input
            id="review-date"
            type="date"
            dir="ltr"
            value={displayDate}
            onChange={(e) => setDisplayDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-sort">{t("form.sort_order")}</Label>
          <Input
            id="review-sort"
            type="number"
            dir="ltr"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2">
          <Switch checked={featured} onCheckedChange={setFeatured} />
          <span className="text-sm">{t("form.featured")}</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={isVisible} onCheckedChange={setIsVisible} />
          <span className="text-sm">{t("form.visible")}</span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || uploading}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {mode === "edit" ? t("form.save") : t("form.create")}
        </Button>
        {mode === "edit" && onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t("form.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
