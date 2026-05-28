// Top-level admin layout. Pass-through only — the real auth gate, sidebar,
// and topbar live in `[locale]/admin/(authed)/layout.tsx`. The login page
// (`[locale]/admin/login/page.tsx`) sits outside the `(authed)` route group
// so it renders without the auth shell.
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      {children}
    </div>
  )
}
