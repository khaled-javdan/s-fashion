import { Skeleton } from "@workspace/ui/components/skeleton"

/** Reusable loading skeleton for static content pages (About, Shipping, Returns, etc.) */
export function ContentPageSkeleton() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3 border-b border-border pb-8">
        <Skeleton className="h-10 w-56 rounded" />
        <Skeleton className="h-4 w-96 max-w-full rounded" />
      </header>

      <div className="mt-10 space-y-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </div>
        ))}
      </div>
    </article>
  )
}
