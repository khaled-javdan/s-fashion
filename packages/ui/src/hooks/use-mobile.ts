import * as React from "react"

// Treat tablets (e.g. iPad portrait at 810–834px) as "mobile" so the admin
// sidebar collapses to an off-canvas drawer instead of permanently occupying
// horizontal space. 1024 (Tailwind's `lg`) keeps the fixed sidebar only on
// laptops/desktops and iPad landscape, which have the width to spare. The
// admin Sidebar is currently the sole consumer of this hook.
const MOBILE_BREAKPOINT = 1024

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  // Subscribe to the media query as an external store: avoids the
  // setState-in-effect pattern and stays in sync with viewport changes.
  // The server snapshot is `false` (desktop-first) to avoid hydration drift.
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
