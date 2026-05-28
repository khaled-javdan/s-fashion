"use client"

import {
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { useAdminLocale } from "@/components/admin/use-admin-locale"

type NavKey = "dashboard" | "orders" | "products" | "settings"
type NavItem = {
  key: NavKey
  href: string
  icon: LucideIcon
  comingSoon?: boolean
}

export function AdminSidebar() {
  const t = useTranslations("admin")
  const tNav = useTranslations("admin.nav")
  const locale = useAdminLocale()
  const pathname = usePathname()

  const root = `/${locale}/admin`

  const items: NavItem[] = [
    { key: "dashboard", href: root, icon: LayoutDashboard },
    {
      key: "orders",
      href: "#",
      icon: ShoppingBag,
      comingSoon: true,
    },
    {
      key: "products",
      href: "#",
      icon: Package,
      comingSoon: true,
    },
    {
      key: "settings",
      href: "#",
      icon: Settings,
      comingSoon: true,
    },
  ]

  // In RTL (Arabic), anchor the sidebar to the right edge so it sits in the
  // natural "start" position for the reader's writing direction.
  const side = locale === "ar" ? "right" : "left"

  return (
    <Sidebar collapsible="icon" side={side}>
      <SidebarHeader className="h-14 flex-row items-center border-b p-0 px-2">
        <Link
          href={root}
          className="text-sidebar-foreground flex items-center px-2 text-sm font-semibold uppercase tracking-[0.2em]"
        >
          S
          <span className="group-data-[collapsible=icon]:hidden">
            &nbsp;Fashion
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  !item.comingSoon && pathname === item.href
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={tNav(item.key)}
                      aria-disabled={item.comingSoon || undefined}
                      data-coming-soon={item.comingSoon ? "" : undefined}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{tNav(item.key)}</span>
                        {item.comingSoon ? (
                          <span className="text-muted-foreground ms-auto text-[9px] font-semibold uppercase tracking-widest">
                            {t("soon")}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  )
}
