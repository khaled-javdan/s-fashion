"use client"

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
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

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import { useAdminLocale } from "@/components/admin/use-admin-locale"
import {
  emptyProductBlock,
  PRODUCT_SOURCES,
  productSourceHref,
  STATIC_SECTION_LIMITS,
  staticSectionSupportsLimit,
  type HomeBlock,
  type HomeLayoutConfig,
  type ProductBlock,
  type ProductSource,
  type StaticBlock,
} from "@/lib/home-sections-config"
import { localeDirection } from "@/lib/locale"

/**
 * Home-page layout organiser. Reorder + show/hide every block, and add/remove
 * any number of product rows (Best Sellers, New Arrivals, On Sale, …), each with
 * a bilingual title, a catalogue source preset, an item limit, and an optional
 * "See all" override. Static widgets are singletons (toggle + reorder only). The
 * hero is always pinned to the top and isn't listed here.
 */
export function HomeSectionsForm({ initial }: { initial: HomeLayoutConfig }) {
  const t = useTranslations("admin.settings")
  const dir = localeDirection(useAdminLocale())
  const [saved, setSaved] = useState<HomeLayoutConfig>(initial)
  const [blocks, setBlocks] = useState<HomeBlock[]>(initial.blocks)
  const [pending, startTransition] = useTransition()

  const snapshot: HomeLayoutConfig = { blocks }
  const dirty = JSON.stringify(snapshot) !== JSON.stringify(saved)

  function setAt(index: number, next: HomeBlock) {
    setBlocks((list) => list.map((b, i) => (i === index ? next : b)))
  }

  function patchProduct(index: number, partial: Partial<ProductBlock>) {
    setBlocks((list) =>
      list.map((b, i) =>
        i === index && b.type === "products" ? { ...b, ...partial } : b,
      ),
    )
  }

  function move(index: number, delta: -1 | 1) {
    setBlocks((list) => {
      const j = index + delta
      if (j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[index], next[j]] = [next[j]!, next[index]!]
      return next
    })
  }

  function addProductRow() {
    setBlocks((list) => [...list, emptyProductBlock(crypto.randomUUID())])
  }

  function removeAt(index: number) {
    setBlocks((list) => list.filter((_, i) => i !== index))
  }

  function save() {
    // A product row needs at least one title so the storefront has something to
    // render; the source defaults are always valid.
    const blank = blocks.find(
      (b) => b.type === "products" && !b.titleEn.trim() && !b.titleAr.trim(),
    )
    if (blank) {
      toast.error(t("home_sections.error_title_required"))
      return
    }
    const payload = snapshot
    startTransition(async () => {
      const res = await updateSettingsAction({
        key: "home.sections",
        value: payload,
      })
      if (res.ok) {
        setSaved(payload)
        toast.success(t("home_sections.saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  function discard() {
    setBlocks(saved.blocks)
  }

  useSaveBar("settings-home-sections", { dirty, saving: pending, save, discard })

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <p className="text-muted-foreground text-sm">{t("home_sections.help")}</p>

      <ul className="space-y-2">
        {blocks.map((block, index) => (
          <li
            key={block.type === "products" ? block.id : `static:${block.key}`}
            className="bg-card space-y-3 rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <GripVertical
                className="text-muted-foreground/60 size-4 shrink-0"
                aria-hidden="true"
              />
              <span className="flex-1 text-sm font-medium">
                {block.type === "static"
                  ? t(`home_sections.section.${block.key}`)
                  : block.titleEn ||
                    block.titleAr ||
                    t("home_sections.untitled_row")}
              </span>

              <span className="text-muted-foreground text-xs">
                {block.visible
                  ? t("home_sections.shown")
                  : t("home_sections.hidden")}
              </span>
              <Switch
                checked={block.visible}
                onCheckedChange={(v) => setAt(index, { ...block, visible: v })}
                aria-label={t("home_sections.toggle_aria", {
                  name:
                    block.type === "static"
                      ? t(`home_sections.section.${block.key}`)
                      : block.titleEn || t("home_sections.untitled_row"),
                })}
              />

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t("home_sections.move_up_aria")}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 1)}
                  disabled={index === blocks.length - 1}
                  aria-label={t("home_sections.move_down_aria")}
                >
                  <ArrowDown className="size-4" />
                </Button>
                {block.type === "products" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAt(index)}
                    aria-label={t("home_sections.remove_aria")}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            {block.type === "products" ? (
              <ProductRowFields
                dir={dir}
                block={block}
                onPatch={(partial) => patchProduct(index, partial)}
              />
            ) : staticSectionSupportsLimit(block.key) ? (
              <StaticLimitField
                dir={dir}
                block={block}
                onChange={(limit) => setAt(index, { ...block, limit })}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" onClick={addProductRow}>
        <Plus className="size-4" />
        {t("home_sections.add_row")}
      </Button>
    </form>
  )
}

function StaticLimitField({
  dir,
  block,
  onChange,
}: {
  dir: "ltr" | "rtl"
  block: StaticBlock
  onChange: (limit: number | undefined) => void
}) {
  const t = useTranslations("admin.settings")
  const def = STATIC_SECTION_LIMITS[block.key]
  return (
    <div dir={dir} className="ps-7 text-start">
      <div className="grid max-w-40 gap-1.5">
        <Label className="text-xs">{t("home_sections.limit_label")}</Label>
        <Input
          type="number"
          min={1}
          max={48}
          value={block.limit ?? ""}
          placeholder={String(def ?? "")}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === "" ? undefined : Number(raw))
          }}
        />
      </div>
    </div>
  )
}

function ProductRowFields({
  dir,
  block,
  onPatch,
}: {
  dir: "ltr" | "rtl"
  block: ProductBlock
  onPatch: (partial: Partial<ProductBlock>) => void
}) {
  const t = useTranslations("admin.settings")
  const defaultHref = productSourceHref(block.source)

  return (
    <div dir={dir} className="space-y-3 ps-7 text-start">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">
            {t("home_sections.title_en_label")}
          </Label>
          <Input
            value={block.titleEn}
            placeholder="Best Sellers"
            maxLength={60}
            onChange={(e) => onPatch({ titleEn: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">
            {t("home_sections.title_ar_label")}
          </Label>
          <Input
            dir="rtl"
            value={block.titleAr}
            placeholder="الأكثر مبيعًا"
            maxLength={60}
            onChange={(e) => onPatch({ titleAr: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("home_sections.source_label")}</Label>
          <Select
            value={block.source}
            onValueChange={(v) => onPatch({ source: v as ProductSource })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`home_sections.source.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("home_sections.limit_label")}</Label>
          <Input
            type="number"
            min={1}
            max={48}
            value={block.limit}
            onChange={(e) => {
              const raw = e.target.value
              onPatch({ limit: raw === "" ? 1 : Number(raw) })
            }}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">{t("home_sections.cta_label")}</Label>
        <Input
          dir="ltr"
          className="font-mono"
          value={block.ctaHref ?? ""}
          placeholder={defaultHref}
          maxLength={200}
          onChange={(e) => onPatch({ ctaHref: e.target.value || undefined })}
        />
        <p className="text-muted-foreground text-start text-xs">
          {t("home_sections.cta_help")}
        </p>
      </div>
    </div>
  )
}
