import { AdminTablePageSkeleton } from "@/components/admin/admin-page-skeleton"

export default function AdminCouponsLoading() {
  // code · discount · usage · expires · status · actions
  return <AdminTablePageSkeleton rows={8} cols={6} showAction />
}
