"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { Store } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

import { AdminSaveBar, useSaveBarState } from "@/components/admin/save-bar"
import { useAdminLocale } from "@/components/admin/use-admin-locale"
import { LOCALES, type Locale } from "@/lib/locale"

type Props = {
  email: string
}

export function AdminTopbar({ email }: Props) {
  const t = useTranslations("admin")
  const locale = useAdminLocale()
  const pathname = usePathname()
  const { dirty } = useSaveBarState()

  // Build the "switch to other locale" URL by swapping the leading segment.
  const otherLocale: Locale = LOCALES.find((l) => l !== locale) ?? locale
  const switchHref = swapLocale(pathname, locale, otherLocale)

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4",
        dirty ? "bg-foreground text-background" : "bg-background",
      )}
    >
      {dirty ? (
        <AdminSaveBar />
      ) : (
        <>
          <SidebarTrigger />

          <div className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            {email}
          </div>

          <div className="ms-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href={`/${locale}`} target="_blank" rel="noopener noreferrer">
                <Store className="size-4" />
                <span className="hidden sm:inline">{t("view_store")}</span>
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={switchHref} aria-label={t("language_label")}>
                {t("language_toggle")}
              </a>
            </Button>
            <form action={`/${locale}/admin/logout`} method="post">
              <Button type="submit" variant="ghost" size="sm">
                {t("logout")}
              </Button>
            </form>
          </div>
        </>
      )}
    </header>
  )
}

function swapLocale(
  pathname: string,
  current: Locale,
  next: Locale,
): string {
  if (pathname === `/${current}`) return `/${next}`
  const prefix = `/${current}/`
  if (pathname.startsWith(prefix)) {
    return `/${next}/${pathname.slice(prefix.length)}`
  }
  return `/${next}${pathname}`
}
