"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { Maximize2, Minimize2, Store } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { SidebarTrigger, useSidebar } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

import { useAdminContentWidth } from "@/components/admin/admin-content-width"
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
  const { expanded, toggle } = useAdminContentWidth()
  const { state, isMobile } = useSidebar()

  // Build the "switch to other locale" URL by swapping the leading segment.
  const otherLocale: Locale = LOCALES.find((l) => l !== locale) ?? locale
  const switchHref = swapLocale(pathname, locale, otherLocale)

  const isRTL = locale === "ar"
  const sidebarOffset =
    isMobile ? "0px"
    : state === "expanded" ? "var(--sidebar-width)"
    : "var(--sidebar-width-icon)"

  const insetStyle: React.CSSProperties = isRTL
    ? { left: 0, right: sidebarOffset }
    : { left: sidebarOffset, right: 0 }

  return (
    <header
      style={insetStyle}
      className={cn(
        "fixed top-0 z-30 flex h-14 items-center gap-3 border-b px-4 transition-[left,right] duration-200 ease-linear",
        dirty ? "bg-foreground text-background" : "bg-background"
      )}
    >
      {dirty ? (
        <AdminSaveBar />
      ) : (
        <>
          <SidebarTrigger className="shrink-0" />

          <div className="hidden min-w-0 truncate text-xs font-medium tracking-widest text-muted-foreground uppercase sm:block">
            {email}
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-pressed={expanded}
              aria-label={t(expanded ? "collapse_content" : "expand_content")}
              title={t(expanded ? "collapse_content" : "expand_content")}
            >
              {expanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
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

function swapLocale(pathname: string, current: Locale, next: Locale): string {
  if (pathname === `/${current}`) return `/${next}`
  const prefix = `/${current}/`
  if (pathname.startsWith(prefix)) {
    return `/${next}/${pathname.slice(prefix.length)}`
  }
  return `/${next}${pathname}`
}
