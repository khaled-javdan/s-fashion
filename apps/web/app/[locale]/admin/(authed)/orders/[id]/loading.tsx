import { Skeleton } from "@workspace/ui/components/skeleton"

export default function AdminOrderDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back + order number + status + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-20 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-36 rounded" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-40 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Status action buttons */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Customer + address block */}
        <div className="space-y-4 rounded-lg border border-border p-5 lg:col-span-1">
          <Skeleton className="h-4 w-28 rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-0.5">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
            </div>
          ))}
        </div>

        {/* Order items + totals */}
        <div className="space-y-4 rounded-lg border border-border p-5 lg:col-span-2">
          <Skeleton className="h-4 w-24 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="size-14 shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3 rounded-lg border border-border p-5">
        <Skeleton className="h-4 w-24 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="mt-1 size-3 shrink-0 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
