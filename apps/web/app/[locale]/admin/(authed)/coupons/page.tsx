import { getTranslations } from "next-intl/server"

import {
  CouponsTable,
  type CouponRow,
} from "@/components/admin/coupons/coupons-table"
import { listCoupons } from "@/lib/repos/coupons.repo"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

export default async function AdminCouponsPage({
  params,
}: PageProps<"/[locale]/admin/coupons">) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.coupons")

  const coupons = await listCoupons()
  const rows: CouponRow[] = coupons.map(({ _count, ...c }) => ({
    ...c,
    redeemedCount: _count.redemptions,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{t("list.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("list.summary", { count: rows.length })}
        </p>
      </div>

      <CouponsTable coupons={rows} locale={locale} />
    </div>
  )
}
