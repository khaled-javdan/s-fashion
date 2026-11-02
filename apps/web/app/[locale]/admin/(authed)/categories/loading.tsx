import { AdminTablePageSkeleton } from "@/components/admin/admin-page-skeleton"

export default function AdminCategoriesLoading() {
  // order · name · slug · products · active · actions
  return <AdminTablePageSkeleton rows={6} cols={6} showAction />
}
