import { Skeleton } from "@workspace/ui/components/skeleton"

export default function ProductDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-0">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start">
          {/* Main image */}
          <Skeleton className="aspect-[3/4] w-full rounded-md" />
          {/* Thumbnail strip — desktop */}
          <div className="hidden flex-col gap-2 lg:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="size-16 shrink-0 rounded-md" />
            ))}
          </div>
          {/* Dot indicators — mobile */}
          <div className="flex justify-center gap-2 lg:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-1.5 w-1.5 rounded-full" />
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-6">
          {/* Title + price */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-3/4 rounded" />
            <Skeleton className="h-7 w-28 rounded" />
          </div>

          {/* Color swatches */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24 rounded" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="size-8 rounded-full" />
              ))}
            </div>
          </div>

          {/* Size selector */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-20 rounded" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-14 rounded-md" />
              ))}
            </div>
          </div>

          {/* Stock badge */}
          <Skeleton className="h-5 w-20 rounded" />

          {/* Quantity */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>

          {/* Add to cart button */}
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
