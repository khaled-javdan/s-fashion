import { Flame } from "lucide-react"

/**
 * "N sold in the last week" social proof for the PDP.
 *
 * The count comes from real `OrderItem` rows (see `getRecentSalesCount`), and
 * the PDP hides this entirely below {@link MIN_RECENT_SALES_TO_SHOW} rather
 * than advertising a number too small to be persuasive — so the line is always
 * true and never has to be padded.
 *
 * Presentational and server-renderable: the caller supplies the already
 * translated + pluralised label.
 */
export function RecentSalesProof({ label }: { label: string }) {
  return (
    <p className="animate-in fade-in slide-in-from-bottom-1 text-muted-foreground flex items-center gap-2 text-sm duration-700">
      <Flame
        aria-hidden
        className="text-destructive animate-urgency-throb size-4 shrink-0"
      />
      <span>{label}</span>
    </p>
  )
}
