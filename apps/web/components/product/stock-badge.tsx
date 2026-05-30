import { Badge } from "@workspace/ui/components/badge"

type Props = {
  /** Stock available for the relevant scope (selected variant, or aggregate). */
  stock: number
  /** Pre-translated labels (caller supplies via next-intl). */
  labels: {
    inStock: string
    lowStock: string
    outOfStock: string
  }
}

/**
 * Presentational stock indicator. Renders in-stock / only-one-left / out-of-stock.
 * Kept free of `next-intl` hooks so it can render in either a Server or Client
 * tree — callers pass already-translated labels.
 */
export function StockBadge({ stock, labels }: Props) {
  if (stock <= 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        {labels.outOfStock}
      </Badge>
    )
  }

  if (stock === 1) {
    return (
      <Badge variant="destructive" className="text-xs">
        {labels.lowStock}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="text-xs">
      {labels.inStock}
    </Badge>
  )
}
