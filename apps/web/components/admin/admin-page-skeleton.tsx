import { Skeleton } from "@workspace/ui/components/skeleton"

/**
 * Reusable skeleton for admin list pages:
 * page header (title + subtitle + optional action button) + data table.
 */
export function AdminTablePageSkeleton({
  rows = 8,
  cols = 5,
  showAction = true,
}: {
  rows?: number
  cols?: number
  showAction?: boolean
}) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        {showAction && <Skeleton className="h-9 w-32 rounded-md" />}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border">
        {/* Header row */}
        <div className="flex gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-3.5 rounded"
              style={{ width: `${100 / cols}%` }}
            />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0"
          >
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-4 rounded"
                style={{ width: `${(100 / cols) * (j === 0 ? 1.4 : 0.8)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for admin detail / form pages: back link + title + form body. */
export function AdminFormPageSkeleton({ tabs = 0 }: { tabs?: number }) {
  return (
    <div className="w-full space-y-6">
      {/* Back link + title */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24 rounded" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-56 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {/* Optional tab bar */}
      {tabs > 0 && (
        <div className="flex gap-1 border-b border-border pb-px">
          {Array.from({ length: tabs }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-t-md" />
          ))}
        </div>
      )}

      {/* Form sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-lg border border-border p-6">
          <Skeleton className="h-5 w-36 rounded" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3.5 w-20 rounded" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save bar placeholder */}
      <Skeleton className="h-10 w-28 rounded-md" />
    </div>
  )
}
