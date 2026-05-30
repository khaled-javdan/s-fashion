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
 */
export default function OrderPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        @media print {
          [data-slot="sidebar"],
          [data-slot="sidebar-gap"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-trigger"],
          header { display: none !important; }
          main { padding: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div className="bg-white text-black">
        <div className="mx-auto max-w-[148mm] py-4 print:py-0">{children}</div>
      </div>
    </>
  )
}
