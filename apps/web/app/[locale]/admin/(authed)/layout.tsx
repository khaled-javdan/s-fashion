import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import {
  AdminContent,
  AdminContentWidthProvider,
} from "@/components/admin/admin-content-width"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminToasterMount } from "@/components/admin/admin-toaster-mount"
import { AdminTopbar } from "@/components/admin/admin-topbar"
import { SaveBarProvider } from "@/components/admin/save-bar"
import { auth } from "@/lib/auth"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

export default async function AuthedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE

  const session = await auth()
  if (!session?.user) {
    redirect(`/${locale}/admin/login`)
  }

  const cookieStore = await cookies()
  const contentExpanded =
    cookieStore.get("admin_content_expanded")?.value === "1"

  return (
    <TooltipProvider delayDuration={0}>
      <SaveBarProvider>
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset>
            <AdminContentWidthProvider initialExpanded={contentExpanded}>
              <AdminTopbar email={session.user.email ?? ""} />
              <AdminContent>{children}</AdminContent>
            </AdminContentWidthProvider>
          </SidebarInset>
        </SidebarProvider>
        <AdminToasterMount />
      </SaveBarProvider>
    </TooltipProvider>
  )
}
