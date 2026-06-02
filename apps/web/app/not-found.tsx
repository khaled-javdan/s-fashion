/**
 * Root 404 fallback. Renders inside the root layout (which has no i18n
 * provider), so it uses plain English. The localized `[locale]/not-found.tsx`
 * handles the common in-store case; this catches paths outside any locale.
 */
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

export default function RootNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-muted-foreground font-heading text-5xl">404</p>
      <h1 className="font-heading mt-3 text-3xl">Page not found</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/">Back to shop</Link>
        </Button>
      </div>
    </div>
  )
}
