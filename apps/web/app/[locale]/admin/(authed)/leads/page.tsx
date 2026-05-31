import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { LeadsTable } from "@/components/admin/leads/leads-table"
import { countLeads, listLeads } from "@/lib/repos/customers.repo"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

const PAGE_SIZE = 20

export default async function AdminLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const t = await getTranslations("admin.leads")
  const sp = await searchParams

  const q = typeof sp.q === "string" ? sp.q.trim() : ""
  const pageRaw = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const base = `/${locale}/admin/leads`

  const total = await countLeads(q || undefined)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount)
  const skip = (clampedPage - 1) * PAGE_SIZE

  const leads = await listLeads({
    q: q || undefined,
    skip,
    take: PAGE_SIZE,
  })

  const buildPageHref = (target: number) => {
    const usp = new URLSearchParams()
    if (q) usp.set("q", q)
    if (target > 1) usp.set("page", String(target))
    const query = usp.toString()
    return query ? `${base}?${query}` : base
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("summary", { count: total })}
        </p>
      </div>

      <form
        action={base}
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="leads-q" className="text-xs text-muted-foreground">
            {t("search_label")}
          </Label>
          <Input
            id="leads-q"
            name="q"
            defaultValue={q}
            placeholder={t("search_placeholder")}
            className="w-56"
          />
        </div>
        <Button type="submit" size="sm" className="h-11 md:h-10">
          {t("apply")}
        </Button>
        {q ? (
          <Button asChild variant="ghost" size="sm" className="h-11 md:h-10">
            <Link href={base}>{t("clear")}</Link>
          </Button>
        ) : null}
      </form>

      <LeadsTable leads={leads} locale={locale} />

      {pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {t("pagination.page", { current: clampedPage, total: pageCount })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={clampedPage <= 1}
            >
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
