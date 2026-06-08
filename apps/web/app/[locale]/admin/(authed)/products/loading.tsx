import { AdminTablePageSkeleton } from "@/components/admin/admin-page-skeleton"

export default function AdminProductsLoading() {
  // thumb · name · price · stock · status · actions
  return <AdminTablePageSkeleton rows={10} cols={6} showAction />
}
