"use client"

import {
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Ticket,
  UserPlus,
  Users,
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

type NavKey =
  | "dashboard"
  | "orders"
  | "customers"
  | "leads"
  | "products"
  | "reviews"
  | "coupons"
  | "settings"
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
      href: `${root}/orders`,
      icon: ShoppingBag,
    },
    {
      key: "customers",
      href: `${root}/customers`,
      icon: Users,
    },
    {
      key: "leads",
      href: `${root}/leads`,
      icon: UserPlus,
    },
    {
      key: "products",
      href: `${root}/products`,
      icon: Package,
    },
    {
      key: "reviews",
      href: `${root}/reviews`,
      icon: Star,
    },
    {
      key: "coupons",
      href: `${root}/coupons`,
      icon: Ticket,
    },
    {
      key: "settings",
      href: `${root}/settings`,
      icon: Settings,
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
          className="flex items-center px-2 text-sm font-semibold tracking-[0.2em] text-sidebar-foreground uppercase"
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
                // Dashboard matches exactly; section links match their subtree
                // (e.g. /admin/orders/123 keeps "Orders" active).
                const isActive =
                  !item.comingSoon &&
                  (item.key === "dashboard"
                    ? pathname === item.href
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`))
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
                          <span className="ms-auto text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
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
