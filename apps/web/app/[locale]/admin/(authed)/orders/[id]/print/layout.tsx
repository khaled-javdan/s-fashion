/**
 * Print layout override.
 *
 * Auth is still enforced by the parent `(authed)/layout.tsx` segment. The
 * actual print isolation (hiding admin chrome, fixing iOS Safari) is done in
 * print.css, which Next.js injects into <head> as a <link> tag — the only
 * place iOS Safari processes @media print rules. An inline <style> inside
 * <body> is silently ignored by iOS during printing.
 *
 * The [data-print-only] attribute on the wrapper div is the hook used by
 * print.css to isolate the slip from all surrounding admin UI.
 */
import "./print.css"

export default function OrderPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      data-print-only
      style={{
        background: "white",
        color: "#1f1916",
        maxWidth: "148mm",
        margin: "0 auto",
        padding: "1rem",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
      className="print:max-w-none print:p-0"
    >
      {children}
    </div>
  )
}
