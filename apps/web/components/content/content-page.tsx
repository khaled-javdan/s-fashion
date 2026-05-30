import type { ReactNode } from "react"

/**
 * Shared layout for static informational pages (Shipping, Returns, About,
 * Contact…). Keeps the prose width, heading rhythm, and divider consistent
 * across every footer "Help" page. Server Component — presentational only.
 *
 * RTL-safe: spacing uses logical utilities and lists use `ps-*`, so the same
 * markup renders correctly in Arabic and English.
 */
export function ContentPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="font-heading text-3xl tracking-wide text-foreground sm:text-4xl">
          {title}
        </h1>
        {intro ? (
          <p className="text-muted-foreground leading-relaxed">{intro}</p>
        ) : null}
      </header>
      <div className="mt-10 space-y-10">{children}</div>
    </article>
  )
}

/**
 * A single titled block within a {@link ContentPage}. Pass prose as children
 * (paragraphs, lists, CTAs).
 */
export function ContentSection({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl tracking-wide text-foreground">
        {heading}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

/** Shape of a section entry stored in the locale message bundles. */
export type ContentSectionData = {
  heading: string
  body?: string[]
  items?: string[]
}

/**
 * Renders an array of {@link ContentSectionData} (typically `t.raw("sections")`)
 * as a sequence of {@link ContentSection}s. Each section may carry paragraphs
 * (`body`) and/or a bulleted list (`items`).
 */
export function ContentSections({
  sections,
}: {
  sections: ContentSectionData[]
}) {
  return (
    <>
      {sections.map((section, i) => (
        <ContentSection key={i} heading={section.heading}>
          {section.body?.map((paragraph, j) => (
            <p key={j}>{paragraph}</p>
          ))}
          {section.items && section.items.length > 0 ? (
            <ul className="list-disc space-y-1 ps-5 marker:text-muted-foreground/60">
              {section.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          ) : null}
        </ContentSection>
      ))}
    </>
  )
}
