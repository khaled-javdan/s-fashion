import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CategoryEditor } from "@/components/admin/categories/category-editor"
import {
  getCategoryWithProductIds,
  listProductsForPicker,
} from "@/lib/repos/categories.repo"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

export default async function AdminCategoryPage({
  params,
}: PageProps<"/[locale]/admin/categories/[id]">) {
  const { locale: localeParam, id } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.categories")

  const [category, products] = await Promise.all([
    getCategoryWithProductIds(id),
    listProductsForPicker(),
  ])
  if (!category) notFound()

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href={`/${locale}/admin/categories`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t("nav.back")}
        </Link>
        <h1 className="font-heading mt-2 text-3xl">
          {locale === "ar" ? category.nameAr : category.nameEn}
        </h1>
      </div>

      <CategoryEditor category={category} products={products} locale={locale} />
    </div>
  )
}
