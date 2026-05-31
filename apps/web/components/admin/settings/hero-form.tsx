"use client"

import Image from "next/image"
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"
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

import {
  updateHeroAction,
  uploadHeroImageAction,
} from "@/app/[locale]/admin/(authed)/settings/actions"
import { AiImageAnalyzePanel } from "@/components/admin/ai/ai-image-analyze-panel"
import { AiTranslatePairButton } from "@/components/admin/ai/ai-translate-pair-button"
import { useSaveBar } from "@/components/admin/save-bar"
import { EMPTY_SLIDE, type HeroConfig, type HeroSlideConfig } from "@/lib/hero-config"
import type { ProductLinkOption } from "@/lib/repos/products.repo"

/** Bilingual hero-copy fields AI can suggest, mapped 1:1 onto the slide draft. */
const HERO_SUGGESTION_FIELDS = [
  "eyebrowEn",
  "eyebrowAr",
  "headlineEn",
  "headlineAr",
  "subtextEn",
  "subtextAr",
  "ctaLabelEn",
  "ctaLabelAr",
] as const satisfies ReadonlyArray<keyof HeroSlideConfig>

type SlideDraft = HeroSlideConfig & { _key: string }

export function HeroForm({
  initial,
  productLinks,
}: {
  initial: HeroConfig
  productLinks: ProductLinkOption[]
}) {
  const t = useTranslations("admin.settings")
  const keySeq = useRef(initial.slides.length)
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState<HeroConfig>(initial)
  const [enabled, setEnabled] = useState(saved.enabled)
  const [slides, setSlides] = useState<SlideDraft[]>(() =>
    saved.slides.map((s, i) => ({ ...s, _key: `s-${i}` })),
  )
  const [pending, startTransition] = useTransition()

  // Drop the client-only `_key` so the comparison/save payload matches the
  // stored shape exactly.
  const stripped: HeroConfig = {
    enabled,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    slides: slides.map(({ _key, ...s }) => s),
  }
  const dirty = JSON.stringify(stripped) !== JSON.stringify(saved)

  function updateSlide(key: string, patch: Partial<HeroSlideConfig>) {
    setSlides((list) =>
      list.map((s) => (s._key === key ? { ...s, ...patch } : s)),
    )
  }

  function addSlide() {
    setSlides((list) => [
      ...list,
      { ...EMPTY_SLIDE, _key: `s-${keySeq.current++}` },
    ])
  }

  function removeSlide(key: string) {
    setSlides((list) => list.filter((s) => s._key !== key))
  }

  function move(key: string, dir: -1 | 1) {
    setSlides((list) => {
      const i = list.findIndex((s) => s._key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  function save() {
    if (enabled && slides.length === 0) {
      toast.error(t("hero.error_no_slides"))
      return
    }
    if (slides.some((s) => !s.imageUrl)) {
      toast.error(t("hero.error_missing_image"))
      return
    }

    const snapshot = stripped
    startTransition(async () => {
      const res = await updateHeroAction(snapshot)
      if (res.ok) {
        setSaved(snapshot)
        toast.success(t("hero.saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  function discard() {
    setEnabled(saved.enabled)
    keySeq.current = saved.slides.length
    setSlides(saved.slides.map((s, i) => ({ ...s, _key: `s-${i}` })))
  }

  useSaveBar("settings-hero", { dirty, saving: pending, save, discard })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>{t("hero.show_label")}</Label>
          <p className="text-muted-foreground text-xs">
            {t("hero.show_help")}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-4">
        {slides.length === 0 ? (
          <div className="border-input text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-sm">
            <ImagePlus className="size-5" />
            <span>{t("hero.empty_state")}</span>
          </div>
        ) : (
          slides.map((slide, index) => (
            <SlideCard
              key={slide._key}
              slide={slide}
              index={index}
              total={slides.length}
              productLinks={productLinks}
              onChange={(patch) => updateSlide(slide._key, patch)}
              onRemove={() => removeSlide(slide._key)}
              onMoveUp={() => move(slide._key, -1)}
              onMoveDown={() => move(slide._key, 1)}
            />
          ))
        )}

        <Button type="button" variant="outline" onClick={addSlide}>
          <Plus className="size-4" />
          {t("hero.add_slide")}
        </Button>
      </div>
    </form>
  )
}

function SlideCard({
  slide,
  index,
  total,
  productLinks,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  slide: SlideDraft
  index: number
  total: number
  productLinks: ProductLinkOption[]
  onChange: (patch: Partial<HeroSlideConfig>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const t = useTranslations("admin.settings")
  const [uploading, setUploading] = useState(false)
  const [uploadingPoster, setUploadingPoster] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const posterInputRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadHeroImageAction(fd)
      if (res.ok) {
        onChange({ imageUrl: res.data.url })
        toast.success(t("hero.image_uploaded_toast"))
      } else {
        toast.error(res.error)
      }
    } finally {
      setUploading(false)
    }
  }

  async function onPosterFile(file: File) {
    setUploadingPoster(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadHeroImageAction(fd)
      if (res.ok) {
        onChange({ posterUrl: res.data.url })
        toast.success(t("hero.image_uploaded_toast"))
      } else {
        toast.error(res.error)
      }
    } finally {
      setUploadingPoster(false)
    }
  }

  /** Apply AI suggestions onto this slide (overwrites the matched fields). */
  function applySuggestions(s: Record<string, unknown>) {
    const patch: Partial<HeroSlideConfig> = {}
    for (const f of HERO_SUGGESTION_FIELDS) {
      const v = s[f]
      if (typeof v === "string" && v.trim() !== "") patch[f] = v.trim()
    }
    if (Object.keys(patch).length > 0) onChange(patch)
  }

  return (
    <div className="bg-card space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {t("hero.slide_number", { number: index + 1 })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label={t("hero.move_up_aria")}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={t("hero.move_down_aria")}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={t("hero.remove_slide_aria")}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>{t("hero.image_label")}</Label>
        {slide.imageUrl ? (
          <div className="relative aspect-[16/9] w-full max-w-md overflow-hidden rounded-md border">
            <Image
              src={slide.imageUrl}
              alt={t("hero.image_preview_alt", { number: index + 1 })}
              fill
              sizes="448px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => onChange({ imageUrl: "" })}
              aria-label={t("hero.remove_image_aria")}
              className="bg-background/80 hover:bg-background absolute end-2 top-2 rounded-full p-1.5 shadow transition"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="border-input text-muted-foreground hover:bg-muted flex aspect-[16/9] w-full max-w-md flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm transition disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span>
              {uploading
                ? t("hero.uploading")
                : t("hero.upload_prompt")}
            </span>
          </button>
        )}
        <input
          ref={inputRef}
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

      <div className="grid gap-2">
        <Label>{t("hero.video_label")}</Label>
        <Input
          dir="ltr"
          className="font-mono"
          value={slide.videoUrl}
          onChange={(e) => onChange({ videoUrl: e.target.value })}
          placeholder="https://…/hero.mp4"
        />
        <p className="text-muted-foreground text-xs">
          {t("hero.video_help")}
        </p>
      </div>

      {slide.videoUrl ? (
        <div className="grid gap-2">
          <Label>{t("hero.poster_label")}</Label>
          {slide.posterUrl ? (
            <div className="relative aspect-[16/9] w-full max-w-md overflow-hidden rounded-md border">
              <Image
                src={slide.posterUrl}
                alt={t("hero.poster_preview_alt", { number: index + 1 })}
                fill
                sizes="448px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => onChange({ posterUrl: "" })}
                aria-label={t("hero.remove_poster_aria")}
                className="bg-background/80 hover:bg-background absolute end-2 top-2 rounded-full p-1.5 shadow transition"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => posterInputRef.current?.click()}
              disabled={uploadingPoster}
              className="border-input text-muted-foreground hover:bg-muted flex aspect-[16/9] w-full max-w-md flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm transition disabled:opacity-60"
            >
              {uploadingPoster ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5" />
              )}
              <span>
                {uploadingPoster
                  ? t("hero.uploading")
                  : t("hero.poster_upload_prompt")}
              </span>
            </button>
          )}
          <input
            ref={posterInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPosterFile(f)
              e.target.value = ""
            }}
          />
          <p className="text-muted-foreground text-xs">
            {t("hero.poster_help")}
          </p>
        </div>
      ) : null}

      <AiImageAnalyzePanel
        imageUrls={slide.imageUrl ? [slide.imageUrl] : []}
        schema="hero-slide-suggestions-v1"
        context="hero-slide"
        onSuggestions={applySuggestions}
        idleHint={t("hero.ai_idle_hint")}
      />

      <PairFields
        label={t("hero.eyebrow_label")}
        en={slide.eyebrowEn}
        ar={slide.eyebrowAr}
        onEn={(v) => onChange({ eyebrowEn: v })}
        onAr={(v) => onChange({ eyebrowAr: v })}
        context="slide-eyebrow"
        placeholderEn="New collection"
        placeholderAr="تشكيلة جديدة"
      />
      <PairFields
        label={t("hero.headline_label")}
        en={slide.headlineEn}
        ar={slide.headlineAr}
        onEn={(v) => onChange({ headlineEn: v })}
        onAr={(v) => onChange({ headlineAr: v })}
        context="slide-headline"
        placeholderEn="Timeless mukhawar, delivered"
        placeholderAr="مخاور خالدة، يُوصَّل إليكِ"
      />
      <PairFields
        label={t("hero.subtext_label")}
        multiline
        en={slide.subtextEn}
        ar={slide.subtextAr}
        onEn={(v) => onChange({ subtextEn: v })}
        onAr={(v) => onChange({ subtextAr: v })}
        context="slide-subtext"
        placeholderEn="Handcrafted pieces for every occasion."
        placeholderAr="قطع مصنوعة بعناية لكل مناسبة."
      />
      <PairFields
        label={t("hero.cta_label_label")}
        en={slide.ctaLabelEn}
        ar={slide.ctaLabelAr}
        onEn={(v) => onChange({ ctaLabelEn: v })}
        onAr={(v) => onChange({ ctaLabelAr: v })}
        context="slide-cta"
        placeholderEn="Shop now"
        placeholderAr="تسوّقي الآن"
      />

      <div className="grid gap-2">
        <Label>{t("hero.button_link_label")}</Label>
        {productLinks.length > 0 ? (
          <Select
            value={
              productLinks.some((p) => slide.ctaHref === `/products/${p.slug}`)
                ? slide.ctaHref
                : ""
            }
            onValueChange={(href) => onChange({ ctaHref: href })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("hero.product_link_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {productLinks.map((p) => (
                <SelectItem key={p.slug} value={`/products/${p.slug}`}>
                  {p.nameEn} · {p.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Input
          dir="ltr"
          className="font-mono"
          value={slide.ctaHref}
          onChange={(e) => onChange({ ctaHref: e.target.value })}
          placeholder="/products/your-slug"
        />
        <p className="text-muted-foreground text-xs">
          {t.rich("hero.button_link_help", {
            code: (chunks) => <code className="font-mono">{chunks}</code>,
          })}
        </p>
      </div>
    </div>
  )
}

/** A labelled English + Arabic field pair (Input, or Textarea when multiline). */
function PairFields({
  label,
  en,
  ar,
  onEn,
  onAr,
  context,
  placeholderEn,
  placeholderAr,
  multiline = false,
}: {
  label: string
  en: string
  ar: string
  onEn: (v: string) => void
  onAr: (v: string) => void
  /** Surface hint for the translate button (omit to hide the button). */
  context?: string
  placeholderEn?: string
  placeholderAr?: string
  multiline?: boolean
}) {
  const t = useTranslations("admin.settings")
  return (
    <div className="grid gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label>{label}</Label>
        {context ? (
          <AiTranslatePairButton
            valueEn={en}
            valueAr={ar}
            context={context}
            onResult={(lang, t) => (lang === "en" ? onEn(t) : onAr(t))}
          />
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">
            {t("hero.field_english")}
          </span>
          {multiline ? (
            <Textarea
              rows={2}
              value={en}
              onChange={(e) => onEn(e.target.value)}
              placeholder={placeholderEn}
            />
          ) : (
            <Input
              value={en}
              onChange={(e) => onEn(e.target.value)}
              placeholder={placeholderEn}
            />
          )}
        </div>
        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">
            {t("hero.field_arabic")}
          </span>
          {multiline ? (
            <Textarea
              dir="rtl"
              rows={2}
              value={ar}
              onChange={(e) => onAr(e.target.value)}
              placeholder={placeholderAr}
            />
          ) : (
            <Input
              dir="rtl"
              value={ar}
              onChange={(e) => onAr(e.target.value)}
              placeholder={placeholderAr}
            />
          )}
        </div>
      </div>
    </div>
  )
}
