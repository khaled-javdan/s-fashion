// Top-level admin layout. The real auth gate, sidebar, and topbar live in
// `[locale]/admin/(authed)/layout.tsx`. The login page
// (`[locale]/admin/login/page.tsx`) sits outside the `(authed)` route group
// so it renders without the auth shell.
//
// We stamp `dir` + `lang` here explicitly (rather than relying on inheritance
// from the outer `[locale]/layout.tsx` div) because Radix UI providers used
// downstream — Tooltip, Sidebar, Tabs — sometimes default to LTR for their
// keyboard navigation and break the writing direction. Anchoring it on the
// admin shell guarantees RTL flows through the entire admin tree.
import { DEFAULT_LOCALE, isLocale, localeDirection } from "@/lib/locale"

export default async function AdminRootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
  const dir = localeDirection(locale)

  return (
    <div
      lang={locale}
      dir={dir}
      className="bg-background text-foreground min-h-screen"
    >
      {children}
    </div>
  )
}
