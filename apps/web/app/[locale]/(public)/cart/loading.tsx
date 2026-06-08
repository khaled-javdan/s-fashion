import { Skeleton } from "@workspace/ui/components/skeleton"

function CartItemSkeleton() {
  return (
    <div className="flex gap-4 py-4">
      <Skeleton className="size-24 shrink-0 rounded-md sm:size-28" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
        <Skeleton className="h-3 w-1/4 rounded" />
        <div className="mt-auto flex items-center justify-between">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}

export default function CartLoading() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Skeleton className="mb-8 h-8 w-32 rounded" />

      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <CartItemSkeleton key={i} />
        ))}
      </div>

      {/* Order summary */}
      <div className="mt-8 rounded-lg border border-border p-6">
        <Skeleton className="mb-4 h-5 w-36 rounded" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
          <Skeleton className="my-2 h-px w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </div>
        <Skeleton className="mt-6 h-11 w-full rounded-md" />
      </div>
    </section>
  )
}
