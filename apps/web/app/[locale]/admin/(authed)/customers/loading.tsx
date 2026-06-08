import { AdminTablePageSkeleton } from "@/components/admin/admin-page-skeleton"

export default function AdminCustomersLoading() {
  // name · phone · emirate · orders · spent · consent · actions
  return <AdminTablePageSkeleton rows={10} cols={7} showAction={false} />
}
