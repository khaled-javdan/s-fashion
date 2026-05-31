import Link from "next/link"
import { getTranslations } from "next-intl/server"

import type { Customer } from "@workspace/db"

import { formatEmirate } from "@/components/admin/orders/emirate"
import { type Locale } from "@/lib/locale"

function formatDate(date: Date | null, locale: Locale): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

/** Render the lead's location from the richest field available. */
function formatLocation(lead: Customer, locale: Locale): string {
  const parts: string[] = []
  if (lead.city) parts.push(lead.city)
  if (lead.emirate) parts.push(formatEmirate(lead.emirate))
  if (parts.length === 0) return "—"
  return parts.join(locale === "ar" ? "، " : ", ")
}

export async function LeadsTable({
  leads,
  locale,
}: {
  leads: Customer[]
  locale: Locale
}) {
  const t = await getTranslations("admin.leads")

  if (leads.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
        {t("empty")}
      </div>
    )
  }

  // Known consent sources map to friendly labels; anything else falls back.
  const sourceLabel = (source: string | null): string => {
    if (source === "home_capture") return t("source.home_capture")
    if (source === "checkout") return t("source.checkout")
    return t("source.other")
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-start text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-start font-medium">{t("table.name")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("table.phone")}</th>
            <th className="px-4 py-3 text-start font-medium">
              {t("table.source")}
            </th>
            <th className="px-4 py-3 text-start font-medium">
              {t("table.location")}
            </th>
            <th className="px-4 py-3 text-start font-medium">
              {t("table.subscribed")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/${locale}/admin/customers/${lead.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {lead.name}
                </Link>
              </td>
              <td className="px-4 py-3" dir="ltr">
                {lead.phone}
              </td>
              <td className="px-4 py-3">
                <span className="bg-muted inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                  {sourceLabel(lead.consentSource)}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {formatLocation(lead, locale)}
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {formatDate(lead.consentAt, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
