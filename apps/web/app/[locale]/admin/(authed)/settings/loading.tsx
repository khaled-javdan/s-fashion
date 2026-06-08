import { Skeleton } from "@workspace/ui/components/skeleton"

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>

      {/* Tab list */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-t-md" />
        ))}
      </div>

      {/* Active tab content — show 2 form sections */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-lg border border-border p-6">
          <Skeleton className="h-5 w-40 rounded" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Skeleton className="h-10 w-28 rounded-md" />
    </div>
  )
}
