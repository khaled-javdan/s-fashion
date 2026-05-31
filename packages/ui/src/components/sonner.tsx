"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Brand toaster. We deliberately do NOT use sonner's `richColors` — that swaps
 * in sonner's own bright green/red/amber palette, which clashes with the muted
 * design system. Instead every toast renders on the popover surface
 * (`--popover` / `--popover-foreground` / `--border`), and the per-type accent
 * (the icon + a thin inline-start border) is driven by our tokens:
 *   success → --primary, error → --destructive, warning → --warning (token with
 *   a --destructive fallback), info → --primary.
 *
 * This reads on-brand in both light and dark because the tokens flip with the
 * theme. RTL (`dir`) and the close button are still controlled by the caller.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      {/* Token-driven per-type accents. Scoped here (not globals.css) so the
          toaster is self-contained: each type tints its leading icon + a thin
          inline-start bar using a design token, on the shared popover surface. */}
      <style>{`
        .cn-toast { border-inline-start-width: 3px; border-inline-start-style: solid; border-inline-start-color: var(--border); }
        .cn-toast [data-icon] { color: var(--popover-foreground); }
        .cn-toast--success { border-inline-start-color: var(--primary); }
        .cn-toast--success [data-icon] { color: var(--primary); }
        .cn-toast--error { border-inline-start-color: var(--destructive); }
        .cn-toast--error [data-icon] { color: var(--destructive); }
        .cn-toast--warning { border-inline-start-color: var(--warning, var(--destructive)); }
        .cn-toast--warning [data-icon] { color: var(--warning, var(--destructive)); }
        .cn-toast--info { border-inline-start-color: var(--primary); }
        .cn-toast--info [data-icon] { color: var(--primary); }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Per-type accent colours sourced from design tokens (no richColors).
          "--success-bg": "var(--popover)",
          "--success-text": "var(--popover-foreground)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--popover-foreground)",
          "--error-border": "var(--border)",
          "--warning-bg": "var(--popover)",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border": "var(--border)",
          "--info-bg": "var(--popover)",
          "--info-text": "var(--popover-foreground)",
          "--info-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          // Tint just the leading icon per type, so each toast is recognisable
          // without sonner's loud full-surface colours.
          success: "cn-toast--success",
          error: "cn-toast--error",
          warning: "cn-toast--warning",
          info: "cn-toast--info",
        },
      }}
      {...props}
        // Force off after the spread: callers (cart/admin mounts) historically
        // passed `richColors`, which would swap in sonner's stock palette and
        // override the token-driven accents above. We own the brand styling here.
        richColors={false}
      />
    </>
  )
}

export { Toaster }
