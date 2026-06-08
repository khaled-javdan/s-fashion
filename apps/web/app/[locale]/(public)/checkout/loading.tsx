import { Skeleton } from "@workspace/ui/components/skeleton"

function FieldSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-4 w-24 rounded" />
      <Skeleton className={`h-10 rounded-md ${wide ? "w-full" : "w-full"}`} />
    </div>
  )
}

export default function CheckoutLoading() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Skeleton className="mb-8 h-8 w-36 rounded" />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        {/* Form */}
        <div className="flex flex-col gap-8">
          {/* Contact */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-32 rounded" />
            <FieldSkeleton />
            <FieldSkeleton />
          </div>

          {/* Shipping address */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-40 rounded" />
            <div className="grid grid-cols-2 gap-4">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <FieldSkeleton />
            <FieldSkeleton />
            <div className="grid grid-cols-2 gap-4">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </div>

          <Skeleton className="h-11 w-full rounded-md" />
        </div>

        {/* Order summary */}
        <div className="flex flex-col gap-4 rounded-lg border border-border p-6 lg:self-start">
          <Skeleton className="h-5 w-32 rounded" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-16 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </div>
          ))}
          <Skeleton className="h-px w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </div>
      </div>
    </section>
  )
}
