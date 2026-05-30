"use client"

import { Copy, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import type { Size } from "@workspace/db"
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

import { AiTranslatePairButton } from "@/components/admin/ai/ai-translate-pair-button"

export type FormVariant = {
  id?: string
  colorNameAr?: string | null
  colorNameEn?: string | null
  colorHex?: string | null
  size: Size
  stock: number
  sku?: string | null
}

// Client-safe literal list — importing the Size runtime enum from
// @workspace/db pulls the Prisma client (node:fs) into the browser bundle.
const SIZE_VALUES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "FREE",
] as const satisfies readonly Size[]

export function makeEmptyVariant(): FormVariant {
  return {
    colorNameAr: "",
    colorNameEn: "",
    colorHex: "#C97B84",
    size: "M",
    stock: 0,
    sku: "",
  }
}

type Props = {
  variants: FormVariant[]
  onChange: (variants: FormVariant[]) => void
}

export function VariantsEditor({ variants, onChange }: Props) {
  const t = useTranslations("admin.products")
  const update = (index: number, patch: Partial<FormVariant>) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  const remove = (index: number) => {
    onChange(variants.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...variants, makeEmptyVariant()])
  }

  // Clone a variant, keeping color fields and picking the next size that isn't
  // already used with this color. Stock/SKU reset so they don't carry over.
  const duplicate = (index: number) => {
    const source = variants[index]
    if (!source) return

    const colorKey = (source.colorHex ?? "").toLowerCase()
    const usedSizes = new Set(
      variants
        .filter((v) => (v.colorHex ?? "").toLowerCase() === colorKey)
        .map((v) => v.size),
    )
    const nextSize =
      SIZE_VALUES.find((s) => !usedSizes.has(s)) ?? source.size

    const clone: FormVariant = {
      colorNameAr: source.colorNameAr,
      colorNameEn: source.colorNameEn,
      colorHex: source.colorHex,
      size: nextSize,
      stock: 0,
      sku: "",
    }
    onChange([
      ...variants.slice(0, index + 1),
      clone,
      ...variants.slice(index + 1),
    ])
  }

  // Flag duplicate (colorHex, size) pairs so the editor surfaces them inline.
  const dupKeys = new Set<string>()
  const seen = new Set<string>()
  for (const v of variants) {
    const key = `${(v.colorHex ?? "").toLowerCase()}::${v.size}`
    if (seen.has(key)) dupKeys.add(key)
    seen.add(key)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {variants.map((v, idx) => {
          const key = `${(v.colorHex ?? "").toLowerCase()}::${v.size}`
          const isDuplicate = dupKeys.has(key)
          return (
            <div
              key={idx}
              className={`grid gap-3 rounded-md border p-3 sm:grid-cols-12 ${
                isDuplicate ? "border-destructive" : ""
              }`}
            >
              <div className="sm:col-span-2">
                <div className="flex min-h-7 items-center">
                  <Label className="text-xs">{t("variants.color")}</Label>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={v.colorHex ?? "#000000"}
                    onChange={(e) =>
                      update(idx, { colorHex: e.target.value })
                    }
                    aria-label={t("variants.color")}
                    className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0.5"
                  />
                  <Input
                    value={v.colorHex ?? ""}
                    onChange={(e) =>
                      update(idx, { colorHex: e.target.value })
                    }
                    placeholder="#C97B84"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex min-h-7 items-center justify-between gap-1">
                  <Label className="text-xs">{t("variants.color_en")}</Label>
                  <AiTranslatePairButton
                    valueEn={v.colorNameEn ?? ""}
                    valueAr={v.colorNameAr ?? ""}
                    context="product-color-name"
                    iconOnly
                    onResult={(lang, t) =>
                      update(
                        idx,
                        lang === "en"
                          ? { colorNameEn: t }
                          : { colorNameAr: t },
                      )
                    }
                  />
                </div>
                <Input
                  className="mt-1"
                  value={v.colorNameEn ?? ""}
                  onChange={(e) =>
                    update(idx, { colorNameEn: e.target.value })
                  }
                  placeholder="Rosewood"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex min-h-7 items-center">
                  <Label className="text-xs">{t("variants.color_ar")}</Label>
                </div>
                <Input
                  className="mt-1"
                  dir="rtl"
                  value={v.colorNameAr ?? ""}
                  onChange={(e) =>
                    update(idx, { colorNameAr: e.target.value })
                  }
                  placeholder="وردي"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex min-h-7 items-center">
                  <Label className="text-xs">{t("variants.size")}</Label>
                </div>
                <Select
                  value={v.size}
                  onValueChange={(value) =>
                    update(idx, { size: value as Size })
                  }
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_VALUES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-1">
                <div className="flex min-h-7 items-center">
                  <Label className="text-xs">{t("variants.stock")}</Label>
                </div>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={Number.isFinite(v.stock) ? v.stock : 0}
                  onChange={(e) =>
                    update(idx, {
                      stock: Math.max(
                        0,
                        Math.floor(Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </div>

              <div className="sm:col-span-1">
                <div className="flex min-h-7 items-center">
                  <Label className="text-xs">{t("variants.sku")}</Label>
                </div>
                <Input
                  className="mt-1"
                  value={v.sku ?? ""}
                  onChange={(e) => update(idx, { sku: e.target.value })}
                  placeholder={t("variants.sku_placeholder")}
                />
              </div>

              <div className="flex items-end gap-1 sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => duplicate(idx)}
                  aria-label={t("variants.duplicate_action")}
                  title={t("variants.duplicate_action")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(idx)}
                  disabled={variants.length <= 1}
                  aria-label={t("variants.remove")}
                  title={t("variants.remove")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {isDuplicate ? (
                <p className="text-destructive sm:col-span-12 text-xs">
                  {t("variants.duplicate")}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" />
        {t("variants.add")}
      </Button>
    </div>
  )
}
