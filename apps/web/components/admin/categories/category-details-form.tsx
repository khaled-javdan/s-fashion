"use client"

import { useTranslations } from "next-intl"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"

export type CategoryDetailsState = {
  nameEn: string
  nameAr: string
  slug: string
  descEn: string
  descAr: string
  isActive: boolean
  showInMenu: boolean
}

/** Form state → action payload (trimmed; empty descriptions become null). */
export function toCategoryPayload(s: CategoryDetailsState) {
  return {
    nameEn: s.nameEn.trim(),
    nameAr: s.nameAr.trim(),
    slug: s.slug.trim(),
    descEn: s.descEn.trim() || null,
    descAr: s.descAr.trim() || null,
    isActive: s.isActive,
    showInMenu: s.showInMenu,
  }
}

export function slugifyCategory(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function validateCategoryDetails(
  s: CategoryDetailsState,
  t: (key: string) => string,
): string | null {
  if (s.nameEn.trim() === "") return t("validation.name_en_required")
  if (s.nameAr.trim() === "") return t("validation.name_ar_required")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug.trim()) || s.slug.trim().length < 2)
    return t("validation.slug_invalid")
  return null
}

/**
 * Names + slug + visibility fields, shared by the "new category" dialog and the
 * category edit page. Controlled: the parent owns state and saving.
 */
export function CategoryDetailsFields({
  value,
  onChange,
  slugEdited,
  onSlugEdited,
}: {
  value: CategoryDetailsState
  onChange: (next: CategoryDetailsState) => void
  /** Once the slug is typed by hand, stop deriving it from the English name. */
  slugEdited: boolean
  onSlugEdited: () => void
}) {
  const t = useTranslations("admin.categories")
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-name-en">{t("form.name_en")}</Label>
          <Input
            id="category-name-en"
            value={value.nameEn}
            placeholder={t("form.name_en_placeholder")}
            onChange={(e) =>
              onChange({
                ...value,
                nameEn: e.target.value,
                slug: slugEdited ? value.slug : slugifyCategory(e.target.value),
              })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-name-ar">{t("form.name_ar")}</Label>
          <Input
            id="category-name-ar"
            dir="rtl"
            value={value.nameAr}
            placeholder={t("form.name_ar_placeholder")}
            onChange={(e) => onChange({ ...value, nameAr: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-slug">{t("form.slug")}</Label>
          <Input
            id="category-slug"
            dir="ltr"
            className="font-mono text-sm"
            value={value.slug}
            onChange={(e) => {
              onSlugEdited()
              onChange({ ...value, slug: e.target.value })
            }}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-desc-en">{t("form.desc_en")}</Label>
          <Textarea
            id="category-desc-en"
            rows={3}
            maxLength={2000}
            value={value.descEn}
            placeholder={t("form.desc_placeholder")}
            onChange={(e) => onChange({ ...value, descEn: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-desc-ar">{t("form.desc_ar")}</Label>
          <Textarea
            id="category-desc-ar"
            dir="rtl"
            rows={3}
            maxLength={2000}
            value={value.descAr}
            onChange={(e) => onChange({ ...value, descAr: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <Switch
            checked={value.isActive}
            onCheckedChange={(isActive) => onChange({ ...value, isActive })}
          />
          <div>
            <div className="text-sm font-medium">{t("form.active")}</div>
            <div className="text-muted-foreground text-xs">
              {t("form.active_desc")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={value.showInMenu}
            onCheckedChange={(showInMenu) => onChange({ ...value, showInMenu })}
          />
          <div>
            <div className="text-sm font-medium">{t("form.show_in_menu")}</div>
            <div className="text-muted-foreground text-xs">
              {t("form.show_in_menu_desc")}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
