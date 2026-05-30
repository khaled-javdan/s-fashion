/**
 * Compact relative time, e.g. "2h ago", "3d ago". English-only (admin panel).
 * Computed on the server at render time; good enough for an ops list view.
 */
export function relativeTime(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date
  const diffMs = Date.now() - then.getTime()
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 45) return "just now"

  const minutes = Math.round(diffSec / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`

  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`

  const years = Math.round(days / 365)
  return `${years}y ago`
}
