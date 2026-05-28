import { getTranslations } from "next-intl/server"

import { auth } from "@/lib/auth"

// TODO: Round 2 — wire these cards to real repo queries (Track G).
const PLACEHOLDER_CARDS = [
  "orders_today",
  "pending_orders",
  "low_stock",
] as const

export default async function AdminDashboardPage() {
  const session = await auth()
  const name = session?.user?.name ?? "Admin"
  const t = await getTranslations("admin.dashboard")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl">{t("welcome", { name })}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_CARDS.map((key) => (
          <div
            key={key}
            className="bg-card text-card-foreground rounded-md border p-5"
          >
            <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
              {t(key)}
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">—</div>
          </div>
        ))}
      </section>
    </div>
  )
}
