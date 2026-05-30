"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

type Props = {
  description: string
}

/**
 * Product description. Always fully shown on desktop; collapsible on mobile to
 * keep the add-to-cart affordance close to the top of the fold.
 */
export function ProductDescription({ description }: Props) {
  const t = useTranslations("product")
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg tracking-wide">
        {t("description_heading")}
      </h2>
      <p
        className={cn(
          "text-muted-foreground text-sm leading-relaxed whitespace-pre-line",
          !expanded && "line-clamp-4 md:line-clamp-none",
        )}
      >
        {description}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-foreground inline-flex w-fit items-center gap-1 text-sm underline-offset-4 hover:underline md:hidden"
        aria-expanded={expanded}
      >
        {expanded ? t("read_less") : t("read_more")}
        <ChevronDown
          className={cn("size-4 transition-transform", expanded && "rotate-180")}
        />
      </button>
    </section>
  )
}
