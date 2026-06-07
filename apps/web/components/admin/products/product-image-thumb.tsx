"use client"

import { ChevronDown, ChevronUp, X } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Image from "next/image"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type { ImageColorOption } from "./images-uploader"

/** Sentinel for the "no color" choice — Radix Select forbids empty item values. */
const NO_COLOR = "__none__"

type Props = {
  url: string
  alt: string
  index: number
  total: number
  colors: ImageColorOption[]
  colorHex: string | null
  onColorChange: (hex: string | null) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ProductImageThumb({
  url,
  alt,
  index,
  total,
  colors,
  colorHex,
  onColorChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  const t = useTranslations("admin.products")
  const locale = useLocale()
  // The hex saved on an image may no longer match a current variant color
  // (e.g. the variant was recolored); fall back to the raw value so it shows.
  const current = colors.find((c) => c.hex === colorHex)
  // Show the colour name in the active language (Arabic when on /ar).
  const labelOf = (c: ImageColorOption) =>
    locale === "ar" ? c.labelAr : c.labelEn

  return (
    <div className="space-y-1.5">
      <div className="group bg-muted relative aspect-square overflow-hidden rounded-md border">
        <Image src={url} alt={alt} fill sizes="160px" className="object-cover" />

        <button
          type="button"
          onClick={onRemove}
          aria-label={t("images.remove")}
          className="bg-background/90 text-foreground absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full border shadow-sm"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="bg-background/90 absolute bottom-1 start-1 flex items-center gap-0.5 rounded-md border p-0.5 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label={t("images.move_earlier")}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <span className="text-muted-foreground px-0.5 text-[10px] tabular-nums">
            {index + 1}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={t("images.move_later")}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Color tag — links this photo to a variant color so the storefront can
          group it into that color's gallery. */}
      {colors.length > 0 ? (
        <Select
          value={colorHex ?? NO_COLOR}
          onValueChange={(v) => onColorChange(v === NO_COLOR ? null : v)}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-full text-xs"
            aria-label={t("images.color_for", { index: index + 1 })}
          >
            <SelectValue placeholder={t("images.no_color")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_COLOR} className="text-xs">
              {t("images.no_color")}
            </SelectItem>
            {colors.map((c) => (
              <SelectItem key={c.hex} value={c.hex} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="border-border/70 inline-block size-3 shrink-0 rounded-full border"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden
                  />
                  {labelOf(c)}
                </span>
              </SelectItem>
            ))}
            {/* A saved hex that no longer matches any current variant colour. */}
            {colorHex && !current ? (
              <SelectItem value={colorHex} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="border-border/70 inline-block size-3 shrink-0 rounded-full border"
                    style={{ backgroundColor: colorHex }}
                    aria-hidden
                  />
                  {colorHex}
                </span>
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
