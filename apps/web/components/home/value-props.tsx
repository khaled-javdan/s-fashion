import { Clock, MessageCircle, Truck, Wallet } from "lucide-react"
import { getTranslations } from "next-intl/server"

import type { Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"
import { getSetting } from "@/lib/repos/settings.repo"

/** Fallback mirrors the seeded `shipping.free_threshold_fils` (600 AED). */
const DEFAULT_FREE_THRESHOLD_FILS = 60_000

/**
 * Trust bar — the biggest conversion lever for cold Instagram traffic landing
 * on a brand-new domain: a clear free-shipping threshold, cash on delivery,
 * delivery speed, and a human on WhatsApp. The free-shipping amount is read
 * live from settings so it tracks whatever the admin sets. Server Component.
 *
 * Divider lines are produced by a 1px grid gap over a `bg-border` track, which
 * is RTL-agnostic (no physical-direction borders to flip).
 */
export async function ValueProps({ locale }: { locale: Locale }) {
  const t = await getTranslations("home")
  const thresholdFils =
    (await getSetting("shipping.free_threshold_fils")) ??
    DEFAULT_FREE_THRESHOLD_FILS
  const amount = formatAed(thresholdFils, locale)

  const items = [
    {
      Icon: Truck,
      title: t("trust_free_shipping_title"),
      desc: t("trust_free_shipping_desc", { amount }),
    },
    {
      Icon: Wallet,
      title: t("trust_cod_title"),
      desc: t("trust_cod_desc"),
    },
    {
      Icon: Clock,
      title: t("trust_delivery_title"),
      desc: t("trust_delivery_desc"),
    },
    {
      Icon: MessageCircle,
      title: t("trust_support_title"),
      desc: t("trust_support_desc"),
    },
  ]

  return (
    <section
      aria-label={t("trust_aria")}
      className="border-border bg-card border-y"
    >
      <ul className="bg-border mx-auto grid w-full max-w-7xl grid-cols-2 gap-px md:grid-cols-4">
        {items.map(({ Icon, title, desc }) => (
          <li
            key={title}
            className="bg-card flex items-center gap-3 px-4 py-5 sm:px-6"
          >
            <Icon
              className="text-primary size-5 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">{title}</p>
              <p className="text-muted-foreground text-xs">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
