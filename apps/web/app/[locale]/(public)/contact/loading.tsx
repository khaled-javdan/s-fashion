import { Skeleton } from "@workspace/ui/components/skeleton"

export default function ContactLoading() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3 border-b border-border pb-8">
        <Skeleton className="h-10 w-48 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-5">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="mt-1 h-9 w-full rounded-md" />
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
          </div>
        ))}
      </div>
    </article>
  )
}
