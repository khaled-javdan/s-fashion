import { Skeleton } from "@workspace/ui/components/skeleton"

export default function AdminCustomerDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back + name */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>

      {/* Info grid */}
      <div className="grid gap-4 rounded-lg border border-border p-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-0.5">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-4 w-36 rounded" />
          </div>
        ))}
      </div>

      {/* Order history table */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32 rounded" />
        <div className="rounded-md border border-border">
          <div className="flex gap-4 border-b border-border px-4 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-1/4 rounded" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-border px-4 py-3.5 last:border-0">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-1/4 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
