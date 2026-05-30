import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { formatEmirate } from "@/components/admin/orders/emirate"
import type { CustomerListItem } from "@/lib/repos/customers.repo"
import { formatAed } from "@/lib/money"
import { type Locale } from "@/lib/locale"

function formatDate(date: Date | null, locale: Locale): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export async function CustomersTable({
  customers,
  locale,
}: {
  customers: CustomerListItem[]
  locale: Locale
}) {
  const t = await getTranslations("admin.customers")

  if (customers.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
        {t("empty")}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-start text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-start font-medium">{t("table.name")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("table.phone")}</th>
            <th className="px-4 py-3 text-start font-medium">
              {t("table.emirate")}
            </th>
            <th className="px-4 py-3 text-end font-medium">
              {t("table.orders")}
            </th>
            <th className="px-4 py-3 text-end font-medium">
              {t("table.total_spent")}
            </th>
            <th className="px-4 py-3 text-start font-medium">
              {t("table.last_order")}
            </th>
            <th className="px-4 py-3 text-start font-medium">
              {t("table.marketing")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/${locale}/admin/customers/${c.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3" dir="ltr">
                {c.phone}
              </td>
              <td className="px-4 py-3">
                {c.emirate ? formatEmirate(c.emirate) : "—"}
              </td>
              <td className="px-4 py-3 text-end tabular-nums">
                {c.ordersCount}
              </td>
              <td className="px-4 py-3 text-end tabular-nums">
                {formatAed(c.totalSpentFils, locale)}
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {formatDate(c.lastOrderAt, locale)}
              </td>
              <td className="px-4 py-3">
                {c.marketingConsent ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {t("marketing_status.subscribed")}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
