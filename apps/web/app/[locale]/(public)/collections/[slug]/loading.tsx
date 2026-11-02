import { Skeleton } from "@workspace/ui/components/skeleton"

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[3/4] w-full rounded-md" />
      <div className="flex flex-col gap-1.5 px-1">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/3 rounded" />
      </div>
    </div>
  )
}

export default function ProductsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-0">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        {/* Search box */}
        <Skeleton className="h-10 w-full max-w-md rounded-md" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-12">
        {/* Filter sidebar — desktop only */}
        <div className="hidden flex-col gap-6 lg:flex">
          <Skeleton className="h-5 w-16 rounded" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-5 w-16 rounded" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-12 rounded-full" />
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
