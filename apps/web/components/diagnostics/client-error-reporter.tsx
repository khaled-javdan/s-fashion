"use client"

import { useEffect } from "react"

import { installGlobalErrorReporting } from "@/lib/client/report-client-error"

/**
 * Installs global `window` error + `unhandledrejection` handlers so client
 * failures that React error boundaries can't catch — anything thrown in an
 * event handler (e.g. the checkout emirate/city `onValueChange`), a timer, or a
 * rejected promise — still get reported to `app/api/client-error`. Idempotent.
 * Renders nothing.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    installGlobalErrorReporting()
  }, [])

  return null
}
