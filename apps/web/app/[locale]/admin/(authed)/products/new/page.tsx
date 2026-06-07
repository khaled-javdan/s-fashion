import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { ProductForm } from "@/components/admin/products/product-form"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"
import { getActiveAiModelId } from "@/lib/services/ai"

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.products")
  const initialAiModel = await getActiveAiModelId()

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href={`/${locale}/admin/products`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← {t("nav.back")}
        </Link>
        <h1 className="font-heading mt-2 text-3xl">{t("form.new_title")}</h1>
      </div>

      <ProductForm mode="create" locale={locale} initialAiModel={initialAiModel} />
    </div>
  )
}
