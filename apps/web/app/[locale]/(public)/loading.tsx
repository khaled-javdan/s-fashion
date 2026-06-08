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

function ProductRowSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-0">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-40 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function HomeLoading() {
  return (
    <div>
      {/* Hero */}
      <Skeleton className="aspect-[4/3] w-full sm:aspect-[16/7]" />

      {/* Product rows */}
      <ProductRowSkeleton />
      <ProductRowSkeleton />
    </div>
  )
}
