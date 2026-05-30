import Link from "next/link"
import { LayoutDashboard, Pencil } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { auth } from "@/lib/auth"

type Props = {
  /** Admin dashboard URL (locale-prefixed by the caller). */
  dashboardHref: string
  /** Contextual "edit this thing" admin URL — omit for a dashboard-only bar. */
  editHref?: string
  /** Label for the edit action, e.g. "Edit product". */
  editLabel?: string
}

/**
 * Floating admin toolbar shown ONLY to authenticated admins while browsing the
 * public storefront. Gives a one-tap jump into the relevant admin screen
 * (e.g. edit this product) plus the dashboard. Renders nothing for guests.
 *
 * Anchored bottom-start so it never collides with the WhatsApp float
 * (bottom-end). Reading the session makes the host page dynamic — fine here,
 * since these pages are already DB-backed per request.
 */
export async function AdminEditBar({ dashboardHref, editHref, editLabel }: Props) {
  const session = await auth()
  if (!session?.user) return null

  const t = await getTranslations("admin.common")

  return (
    <div className="fixed bottom-4 start-4 z-50 print:hidden">
      <div
        dir="ltr"
        className="bg-foreground text-background flex items-center gap-1 rounded-full p-1 shadow-lg ring-1 ring-black/10"
      >
        <span className="ps-2.5 pe-1 text-[10px] font-bold tracking-wider uppercase opacity-70">
          {t("edit_bar.admin")}
        </span>
        {editHref && editLabel ? (
          <Link
            href={editHref}
            className="bg-background/15 hover:bg-background/25 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
          >
            <Pencil className="size-3.5" />
            {editLabel}
          </Link>
        ) : null}
        <Link
          href={dashboardHref}
          className="hover:bg-background/15 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
        >
          <LayoutDashboard className="size-3.5" />
          {t("edit_bar.dashboard")}
        </Link>
      </div>
    </div>
  )
}
