import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Emirate } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"

import { CustomersFilters } from "@/components/admin/customers/customers-filters"
import { CustomersTable } from "@/components/admin/customers/customers-table"
import {
  countCustomers,
  listCustomers,
  type CustomerListItem,
} from "@/lib/repos/customers.repo"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

const PAGE_SIZE = 20
const FETCH_WINDOW = 500

function isEmirate(v: string): v is Emirate {
  return (Object.values(Emirate) as string[]).includes(v)
}

export default async function AdminCustomersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/customers">) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.customers")
  const sp = await searchParams

  const q = typeof sp.q === "string" ? sp.q.trim() : ""
  const emirateParam =
    typeof sp.emirate === "string" && isEmirate(sp.emirate)
      ? sp.emirate
      : undefined
  const consentOnly = sp.consent === "1"
  const repeatOnly = sp.segment === "repeat"
  const pageRaw = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const [fetched, totalCustomers] = await Promise.all([
    listCustomers({
      q: q || undefined,
      consentOnly,
      emirate: emirateParam,
      take: FETCH_WINDOW,
    }),
    countCustomers(),
  ])

  // Repeat-buyer segment depends on derived stats, so filter in memory.
  const filtered: CustomerListItem[] = repeatOnly
    ? fetched.filter((c) => c.ordersCount > 1)
    : fetched

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount)
  const start = (clampedPage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)

  const consentCount = fetched.filter((c) => c.marketingConsent).length

  const buildPageHref = (target: number) => {
    const usp = new URLSearchParams()
    if (q) usp.set("q", q)
    if (emirateParam) usp.set("emirate", emirateParam)
    if (consentOnly) usp.set("consent", "1")
    if (repeatOnly) usp.set("segment", "repeat")
    if (target > 1) usp.set("page", String(target))
    const query = usp.toString()
    return query
      ? `/${locale}/admin/customers?${query}`
      : `/${locale}/admin/customers`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{t("list.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("list.summary", {
            total: totalCustomers,
            subscribed: consentCount,
          })}
        </p>
      </div>

      <CustomersFilters
        locale={locale}
        q={q}
        emirate={emirateParam}
        consentOnly={consentOnly}
        repeatOnly={repeatOnly}
      />

      <p className="text-muted-foreground text-sm">
        {t("list.matches", { count: total })}
      </p>

      <CustomersTable customers={pageItems} locale={locale} />

      {pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {t("pagination.page", { current: clampedPage, total: pageCount })}
          </span>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" disabled={clampedPage <= 1}>
              <Link href={buildPageHref(clampedPage - 1)}>
                {t("pagination.previous")}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={clampedPage >= pageCount}
            >
              <Link href={buildPageHref(clampedPage + 1)}>
                {t("pagination.next")}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
