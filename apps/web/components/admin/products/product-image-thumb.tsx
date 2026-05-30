"use client"

import { ChevronDown, ChevronUp, X } from "lucide-react"
import { useTranslations } from "next-intl"
import Image from "next/image"

import { Button } from "@workspace/ui/components/button"

import type { ImageColorOption } from "./images-uploader"

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
  // The hex saved on an image may no longer match a current variant color
  // (e.g. the variant was recolored); fall back to the raw value so it shows.
  const current = colors.find((c) => c.hex === colorHex)

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
        <label className="flex items-center gap-1.5">
          <span
            className="border-border/70 inline-block size-3.5 shrink-0 rounded-full border"
            style={{
              backgroundColor: current?.hex ?? colorHex ?? "transparent",
            }}
            aria-hidden
          />
          <select
            value={colorHex ?? ""}
            onChange={(e) => onColorChange(e.target.value || null)}
            aria-label={t("images.color_for", { index: index + 1 })}
            className="border-input bg-background h-7 w-full min-w-0 rounded-md border px-1.5 text-xs"
          >
            <option value="">{t("images.no_color")}</option>
            {colors.map((c) => (
              <option key={c.hex} value={c.hex}>
                {c.label}
              </option>
            ))}
            {colorHex && !current ? (
              <option value={colorHex}>{colorHex}</option>
            ) : null}
          </select>
        </label>
      ) : null}
    </div>
  )
}
