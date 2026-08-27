"use client"

import { useEffect, useRef } from "react"

/**
 * Call `onExitIntent` once, the first time the visitor looks like they're
 * leaving the page. Three signals, because "leaving" looks different per device:
 *
 *  - **Desktop**: the pointer exits through the top of the viewport — heading
 *    for the tab bar, the address bar or the close button. Only bound for fine
 *    pointers; a touch screen has no such gesture.
 *  - **Back gesture** (mostly mobile): we park one extra history entry so the
 *    first back press lands here instead of navigating away. A second press
 *    leaves for real — the guard is consumed, never re-pushed.
 *  - **Tab return**: they switched away and came back. Not a departure as such,
 *    but the same moment of hesitation, and it's the only signal available when
 *    someone leaves by closing the tab or switching apps.
 *
 * Fires at most once per mount, and nothing is bound at all while `enabled` is
 * false — so a page that has nothing to offer never touches history.
 */
export function useExitIntent(enabled: boolean, onExitIntent: () => void) {
  // Keep the latest callback without re-binding (and re-pushing history) when
  // the parent re-renders with a new closure. Written in an effect, never
  // during render — the listeners only read it once an event fires.
  const callbackRef = useRef(onExitIntent)
  useEffect(() => {
    callbackRef.current = onExitIntent
  }, [onExitIntent])

  const firedRef = useRef(false)
  // The history guard is parked once per mount, even if eligibility flips
  // (e.g. a failed submit), so we never stack duplicate entries.
  const guardedRef = useRef(false)

  useEffect(() => {
    if (!enabled || firedRef.current) return

    function fire() {
      if (firedRef.current) return
      firedRef.current = true
      callbackRef.current()
    }

    // 1. Pointer leaving through the top edge.
    const finePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: fine)").matches

    function handleMouseOut(event: MouseEvent) {
      // relatedTarget is null only when the pointer left the document itself.
      if (event.relatedTarget) return
      if (event.clientY > 0) return
      fire()
    }

    // 2. Back gesture / button.
    function handlePopState() {
      fire()
    }

    // 3. Coming back to the tab.
    function handleVisibility() {
      if (document.visibilityState === "visible") fire()
    }

    if (finePointer) {
      document.addEventListener("mouseout", handleMouseOut)
    }
    if (!guardedRef.current) {
      guardedRef.current = true
      window.history.pushState({ exitIntentGuard: true }, "")
    }
    window.addEventListener("popstate", handlePopState)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      if (finePointer) {
        document.removeEventListener("mouseout", handleMouseOut)
      }
      window.removeEventListener("popstate", handlePopState)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [enabled])
}
