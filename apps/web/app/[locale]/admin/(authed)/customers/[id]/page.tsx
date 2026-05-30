import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge"
import { formatEmirate } from "@/components/admin/orders/emirate"
import { getCustomerById } from "@/lib/repos/customers.repo"
import { formatAed } from "@/lib/money"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/locale"

function formatDate(date: Date | null, locale: Locale): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  )
}

export default async function AdminCustomerDetailPage({
  params,
}: PageProps<"/[locale]/admin/customers/[id]">) {
  const { locale: localeParam, id } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.customers")

  const customer = await getCustomerById(id)
  if (!customer) notFound()

  const address = [customer.addressLine1, customer.addressLine2, customer.city]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/admin/customers`}
          className="text-muted-foreground text-xs underline-offset-4 hover:underline"
        >
          ← {t("detail.back")}
        </Link>
        <h1 className="font-heading mt-2 text-3xl">{customer.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm" dir="ltr">
          {customer.phone}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">{t("stats.orders")}</p>
          <p className="mt-1 text-2xl tabular-nums">
            {customer.stats.ordersCount}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">
            {t("stats.total_spent")}
          </p>
          <p className="mt-1 text-2xl tabular-nums">
            {formatAed(customer.stats.totalSpentFils, locale)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">
            {t("stats.last_order")}
          </p>
          <p className="mt-1 text-2xl">
            {formatDate(customer.stats.lastOrderAt, locale)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Contact + address */}
        <dl className="space-y-3 rounded-lg border p-4">
          <h2 className="font-heading text-lg">{t("contact.heading")}</h2>
          <Field label={t("contact.email")} value={customer.email} />
          <Field
            label={t("contact.emirate")}
            value={customer.emirate ? formatEmirate(customer.emirate) : null}
          />
          <Field label={t("contact.address")} value={address} />
          <Field
            label={t("contact.preferred_language")}
            value={customer.locale === "ar" ? "العربية" : "English"}
          />
        </dl>

        {/* Marketing consent */}
        <dl className="space-y-3 rounded-lg border p-4">
          <h2 className="font-heading text-lg">{t("marketing.heading")}</h2>
          <Field
            label={t("marketing.status")}
            value={
              customer.marketingConsent ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  {t("marketing_status.subscribed")}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("marketing_status.not_subscribed")}
                </span>
              )
            }
          />
          {customer.marketingConsent ? (
            <>
              <Field
                label={t("marketing.opted_in")}
                value={formatDate(customer.consentAt, locale)}
              />
              <Field
                label={t("marketing.source")}
                value={customer.consentSource}
              />
            </>
          ) : customer.unsubscribedAt ? (
            <Field
              label={t("marketing.unsubscribed")}
              value={formatDate(customer.unsubscribedAt, locale)}
            />
          ) : null}
        </dl>
      </div>

      {/* Order history */}
      <div className="space-y-3">
        <h2 className="font-heading text-lg">{t("orders.heading")}</h2>
        {customer.orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("orders.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("orders.table.order")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("orders.table.date")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("orders.table.status")}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    {t("orders.table.items")}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    {t("orders.table.total")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customer.orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/admin/orders/${o.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {formatDate(o.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {o.items.reduce((sum, i) => sum + i.quantity, 0)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatAed(o.totalFils, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
