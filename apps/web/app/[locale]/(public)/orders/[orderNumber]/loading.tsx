import { Skeleton } from "@workspace/ui/components/skeleton"

export default function OrderDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* Order header */}
      <div className="mb-8 flex flex-col gap-2">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>

      {/* Status tracker */}
      <div className="mb-10 flex items-center justify-between gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
        ))}
      </div>

      {/* Order items */}
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <Skeleton className="h-5 w-24 rounded" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <Skeleton className="size-20 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
          </div>
        ))}
        <Skeleton className="h-px w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  )
}
