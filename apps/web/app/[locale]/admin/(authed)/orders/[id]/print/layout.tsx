/**
 * Print layout override.
 *
 * Auth is still enforced by the parent `(authed)/layout.tsx` segment, which runs
 * above this layout (this nested layout inherits that gate). Because the parent
 * layout renders the admin sidebar + topbar around every authed page, we can't
 * structurally remove that chrome from a nested layout — instead we hide it for
 * print and render the document in a clean, A5-friendly, black-on-white frame.
 *
 * The `@media print` rules below hide the sidebar (shadcn `data-slot="sidebar*"`)
 * and the topbar (`<header>`), and reset the `<main>` padding so the printout is
 * just the order hand-off sheet.
 *
 * Tablet/iOS-Safari notes: on iPad the sidebar renders as an off-canvas drawer
 * (a `data-slot="sidebar"` Sheet plus a `data-slot="sheet-overlay"` backdrop),
 * both hidden below. We also pin the page box to A5 with margins so the sheet
 * fills the paper instead of sitting tiny in a corner, and force
 * `print-color-adjust` so the black rules/borders actually render — iOS Safari
 * drops backgrounds and borders by default.
 */
export default function OrderPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        @page {
          size: A5;
          margin: 10mm;
        }
        @media print {
          [data-slot="sidebar"],
          [data-slot="sidebar-gap"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-trigger"],
          [data-slot="sheet-overlay"],
          header { display: none !important; }
          main { padding: 0 !important; }
          html, body {
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <div className="bg-white text-black">
        <div className="mx-auto max-w-[148mm] py-4 print:max-w-none print:py-0">
          {children}
        </div>
      </div>
    </>
  )
}
