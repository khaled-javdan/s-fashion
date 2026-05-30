import { AnalyticsProvider } from "@/components/analytics/analytics-provider"
import { CartToasterMount } from "@/components/cart/cart-toaster-mount"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { WhatsappFloat } from "@/components/layout/whatsapp-float"
import { CurrencyProvider } from "@/components/providers/currency-provider"
import { getCurrencyContext } from "@/lib/currency-context.server"

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
  const { country, currency, rate, enabledCountries } =
    await getCurrencyContext()

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
        <WhatsappFloat />
        <AnalyticsProvider />
        <CartToasterMount />
      </div>
    </CurrencyProvider>
  )
}
