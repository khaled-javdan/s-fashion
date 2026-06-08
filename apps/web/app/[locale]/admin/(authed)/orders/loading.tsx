import { Skeleton } from "@workspace/ui/components/skeleton"
import { AdminTablePageSkeleton } from "@/components/admin/admin-page-skeleton"

export default function AdminOrdersLoading() {
  return (
    <div className="space-y-6">
      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-t-md" />
        ))}
      </div>

      {/* Search + table */}
      <AdminTablePageSkeleton rows={10} cols={5} showAction={false} />
    </div>
  )
}
