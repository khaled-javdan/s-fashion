import { Skeleton } from "@workspace/ui/components/skeleton"

export default function TrackOrderLoading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-3 pb-8">
        <Skeleton className="h-9 w-52 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    </div>
  )
}
