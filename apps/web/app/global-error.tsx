"use client"

/**
 * Root error boundary. Catches errors thrown in the root layout itself, where
 * no locale/theme providers (and therefore no i18n) are available — so this is
 * intentionally self-contained: it renders its own <html>/<body> and uses plain
 * English copy. Segment-level boundaries below (admin / storefront / checkout)
 * handle the common, localized cases.
 */
import { useEffect } from "react"

import { reportClientError } from "@/lib/client/report-client-error"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError("global-error", error)
  }, [error])

  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f3ece0",
          color: "#2a2320",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ opacity: 0.8, lineHeight: 1.6, marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try again — our team has been
            notified.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#2a2320",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.25rem", fontSize: "0.8rem", opacity: 0.5 }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
