import { getTranslations } from "next-intl/server"

import { CategoriesTable } from "@/components/admin/categories/categories-table"
import { listCategoriesForAdmin } from "@/lib/repos/categories.repo"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

export default async function AdminCategoriesPage({
  params,
}: PageProps<"/[locale]/admin/categories">) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.categories")

  const categories = await listCategoriesForAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{t("list.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("list.summary", { count: categories.length })}
        </p>
      </div>

      <CategoriesTable categories={categories} locale={locale} />
    </div>
  )
}
