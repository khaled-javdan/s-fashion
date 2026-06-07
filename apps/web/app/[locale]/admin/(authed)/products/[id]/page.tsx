import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"

import { ProductForm } from "@/components/admin/products/product-form"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"
import { getProductById } from "@/lib/repos/products.repo"
import { getActiveAiModelId } from "@/lib/services/ai"

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale: localeParam, id } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.products")

  const product = await getProductById(id)
  if (!product) {
    notFound()
  }

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
        <div className="mt-2 flex items-center gap-3">
          <h1 className="font-heading text-3xl">{product.nameEn}</h1>
          <Badge variant={product.isActive ? "default" : "secondary"}>
            {product.isActive ? t("status.active") : t("status.hidden")}
          </Badge>
        </div>
      </div>

      <ProductForm
        mode="edit"
        locale={locale}
        product={product}
        initialAiModel={initialAiModel}
      />
    </div>
  )
}
