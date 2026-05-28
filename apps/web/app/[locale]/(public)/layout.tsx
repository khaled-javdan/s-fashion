import { AnalyticsProvider } from "@/components/analytics/analytics-provider"
import { Footer } from "@/components/layout/footer"
import { Header } from "@/components/layout/header"
import { WhatsappFloat } from "@/components/layout/whatsapp-float"

/**
 * Customer-facing shell. Wraps the home + PDP + content pages with header,
 * footer, WhatsApp button, and analytics. Admin (under `/{locale}/admin`)
 * gets its own shell.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsappFloat />
      <AnalyticsProvider />
    </div>
  )
}
