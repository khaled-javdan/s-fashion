import { Skeleton } from "@workspace/ui/components/skeleton"

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-10">
      {/* Welcome heading */}
      <div className="space-y-1.5">
        <Skeleton className="h-9 w-64 rounded" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>

      {/* Quick-stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border p-5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="mt-3 h-9 w-16 rounded" />
          </div>
        ))}
      </section>

      {/* Analytics section */}
      <section className="space-y-4">
        {/* Heading + range controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-32 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-md" />
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border p-5">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="mt-3 h-7 w-20 rounded" />
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-border p-5 lg:col-span-2">
            <Skeleton className="mb-4 h-4 w-32 rounded" />
            <Skeleton className="h-52 w-full rounded-md" />
          </div>
          <div className="rounded-md border border-border p-5">
            <Skeleton className="mb-4 h-4 w-28 rounded" />
            <Skeleton className="h-52 w-full rounded-md" />
          </div>
        </div>
      </section>
    </div>
  )
}
