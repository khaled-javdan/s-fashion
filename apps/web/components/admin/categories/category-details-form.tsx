"use client"

import { useTranslations } from "next-intl"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

export type CategoryDetailsState = {
  nameEn: string
  nameAr: string
  slug: string
  isActive: boolean
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
    </div>
  )
}
