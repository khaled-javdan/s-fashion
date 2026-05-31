import { AnalyticsProvider } from "@/components/analytics/analytics-provider"
import { CartConfigMount } from "@/components/cart/cart-config-mount"
import { CartToasterMount } from "@/components/cart/cart-toaster-mount"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { WhatsappFloat } from "@/components/layout/whatsapp-float"
import { CurrencyProvider } from "@/components/providers/currency-provider"
import { getCurrencyContext } from "@/lib/currency-context.server"
import { DEFAULT_MAX_QTY_PER_VARIANT } from "@/lib/order-limits"
import { getSetting } from "@/lib/repos/settings.repo"

/**
 * Customer-facing shell. Wraps the home + PDP + content pages with header,
 * footer, WhatsApp button, and analytics. Admin (under `/{locale}/admin`)
 * gets its own shell.
 *
 * Seeds the {@link CurrencyProvider} from the request's ship-to country so the
 * whole storefront renders prices in the shopper's currency.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [
    { country, currency, rate, enabledCountries },
    maxQtySetting,
    whatsappNumber,
  ] = await Promise.all([
    getCurrencyContext(),
    getSetting("order.max_qty_per_variant"),
    getSetting("contact.whatsapp_number"),
  ])
  const maxQtyPerVariant = maxQtySetting ?? DEFAULT_MAX_QTY_PER_VARIANT

  return (
    <CurrencyProvider
      country={country}
      currency={currency}
      rate={rate}
      enabledCountries={enabledCountries}
    >
      <div className="flex min-h-svh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsappFloat phoneNumber={whatsappNumber ?? undefined} />
        <AnalyticsProvider />
        <CartToasterMount />
        <CartConfigMount maxQtyPerVariant={maxQtyPerVariant} />
      </div>
    </CurrencyProvider>
  )
}
