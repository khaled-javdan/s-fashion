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
import { useLocale, useTranslations } from "next-intl"
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

import {
  updateSettingsAction,
  uploadHeroImageAction,
} from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"
import {
  EMPTY_TILE,
  type ShopByConfig,
  type ShopByPreset,
  type ShopByTile,
} from "@/lib/shop-by-config"

type TileDraft = ShopByTile & { _key: string }

export function ShopByForm({
  initial,
  presets,
}: {
  initial: ShopByConfig
  presets: ShopByPreset[]
}) {
  const t = useTranslations("admin.settings")
  const keySeq = useRef(initial.tiles.length)
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState<ShopByConfig>(initial)
  const [enabled, setEnabled] = useState(saved.enabled)
  const [tiles, setTiles] = useState<TileDraft[]>(() =>
    saved.tiles.map((tile, i) => ({ ...tile, _key: `t-${i}` })),
  )
  const [pending, startTransition] = useTransition()

  // Drop the client-only `_key` so the comparison/save payload matches the
  // stored shape exactly.
  const stripped: ShopByConfig = {
    enabled,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tiles: tiles.map(({ _key, ...tile }) => tile),
  }
  const dirty = JSON.stringify(stripped) !== JSON.stringify(saved)

  function updateTile(key: string, patch: Partial<ShopByTile>) {
    setTiles((list) =>
      list.map((tile) => (tile._key === key ? { ...tile, ...patch } : tile)),
    )
  }

  function addTile() {
    setTiles((list) => [
      ...list,
      { ...EMPTY_TILE, _key: `t-${keySeq.current++}` },
    ])
  }

  function removeTile(key: string) {
    setTiles((list) => list.filter((tile) => tile._key !== key))
  }

  function move(key: string, dir: -1 | 1) {
    setTiles((list) => {
      const i = list.findIndex((tile) => tile._key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  function save() {
    if (enabled && tiles.length === 0) {
      toast.error(t("shop_by.error_no_tiles"))
      return
    }
    if (tiles.some((tile) => !tile.imageUrl)) {
      toast.error(t("shop_by.error_missing_image"))
      return
    }
    if (tiles.some((tile) => !tile.href.trim())) {
      toast.error(t("shop_by.error_missing_href"))
      return
    }

    const snapshot = stripped
    startTransition(async () => {
      const res = await updateSettingsAction({
        key: "home.shop_by",
        value: snapshot,
      })
      if (res.ok) {
        setSaved(snapshot)
        toast.success(t("shop_by.saved_toast"))
      } else {
        toast.error(res.error)
      }
    })
  }

  function discard() {
    setEnabled(saved.enabled)
    keySeq.current = saved.tiles.length
    setTiles(saved.tiles.map((tile, i) => ({ ...tile, _key: `t-${i}` })))
  }

  useSaveBar("settings-shop-by", { dirty, saving: pending, save, discard })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>{t("shop_by.show_label")}</Label>
          <p className="text-muted-foreground text-xs">
            {t("shop_by.show_help")}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-4">
        {tiles.length === 0 ? (
          <div className="border-input text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-sm">
            <ImagePlus className="size-5" />
            <span>{t("shop_by.empty_state")}</span>
          </div>
        ) : (
          tiles.map((tile, index) => (
            <TileCard
              key={tile._key}
              tile={tile}
              index={index}
              total={tiles.length}
              presets={presets}
              onChange={(patch) => updateTile(tile._key, patch)}
              onRemove={() => removeTile(tile._key)}
              onMoveUp={() => move(tile._key, -1)}
              onMoveDown={() => move(tile._key, 1)}
            />
          ))
        )}

        <Button
          type="button"
          variant="outline"
          onClick={addTile}
          disabled={tiles.length >= 8}
        >
          <Plus className="size-4" />
          {t("shop_by.add_tile")}
        </Button>
      </div>
    </form>
  )
}

function TileCard({
  tile,
  index,
  total,
  presets,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  tile: TileDraft
  index: number
  total: number
  presets: ShopByPreset[]
  onChange: (patch: Partial<ShopByTile>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const t = useTranslations("admin.settings")
  const locale = useLocale()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reflect the current href in the preset picker only when it matches a known
  // option; otherwise treat it as a custom (free-text) value.
  const presetValue = presets.some((p) => p.value === tile.href)
    ? tile.href
    : ""

  const presetLabel = (p: ShopByPreset) =>
    locale === "ar" ? p.labelAr : p.labelEn

  // Picking a preset sets the target and overwrites both EN/AR labels with the
  // preset's bilingual label (the admin can still edit them afterwards).
  function onPresetChange(href: string) {
    const patch: Partial<ShopByTile> = { href }
    const preset = presets.find((p) => p.value === href)
    if (preset) {
      patch.labelEn = preset.labelEn
      patch.labelAr = preset.labelAr
    }
    onChange(patch)
  }

  async function onFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadHeroImageAction(fd)
      if (res.ok) {
        onChange({ imageUrl: res.data.url })
        toast.success(t("shop_by.image_uploaded_toast"))
      } else {
        toast.error(res.error)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-card space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {t("shop_by.tile_number", { number: index + 1 })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label={t("shop_by.move_up_aria")}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={t("shop_by.move_down_aria")}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={t("shop_by.remove_tile_aria")}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>{t("shop_by.image_label")}</Label>
        {tile.imageUrl ? (
          <div className="relative aspect-[3/4] w-full max-w-[12rem] overflow-hidden rounded-md border">
            <Image
              src={tile.imageUrl}
              alt={t("shop_by.image_preview_alt", { number: index + 1 })}
              fill
              sizes="192px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => onChange({ imageUrl: "" })}
              aria-label={t("shop_by.remove_image_aria")}
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
            className="border-input text-muted-foreground hover:bg-muted flex aspect-[3/4] w-full max-w-[12rem] flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm transition disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            <span>
              {uploading ? t("shop_by.uploading") : t("shop_by.upload_prompt")}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{t("shop_by.label_english")}</Label>
          <Input
            value={tile.labelEn}
            onChange={(e) => onChange({ labelEn: e.target.value })}
            placeholder="On sale"
            maxLength={40}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("shop_by.label_arabic")}</Label>
          <Input
            dir="rtl"
            value={tile.labelAr}
            onChange={(e) => onChange({ labelAr: e.target.value })}
            placeholder="تخفيضات"
            maxLength={40}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>{t("shop_by.target_label")}</Label>
        <Select value={presetValue} onValueChange={onPresetChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("shop_by.target_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {presetLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          dir="ltr"
          className="font-mono"
          value={tile.href}
          onChange={(e) => onChange({ href: e.target.value })}
          placeholder="/products?on_sale=1"
          maxLength={200}
        />
        <p className="text-muted-foreground text-xs">
          {t.rich("shop_by.target_help", {
            code: (chunks) => <code className="font-mono">{chunks}</code>,
          })}
        </p>
      </div>
    </div>
  )
}
