import { Ruler, Scissors, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  fabricMaterialLabel,
  formatFabricLength,
  formatFabricWidth,
} from "@/lib/fabric"
import type { Locale } from "@/lib/locale"

/**
 * PDP block for a FABRIC product: what one piece is (material, width, length)
 * plus a one-line explanation, shown where garments show their size picker
 * context. Renders nothing when the product has no fabric specs.
 */
export async function FabricSpecs({
  material,
  widthCm,
  lengthCm,
  locale,
}: {
  material: string | null
  widthCm: number | null
  lengthCm: number | null
  locale: Locale
}) {
  const t = await getTranslations("product")
  const materialLabel = fabricMaterialLabel(material, locale)

  const rows = [
    materialLabel
      ? { icon: Sparkles, label: t("fabric_material"), value: materialLabel }
      : null,
    widthCm
      ? {
          icon: Ruler,
          label: t("fabric_width"),
          value: formatFabricWidth(widthCm, locale),
        }
      : null,
    lengthCm
      ? {
          icon: Scissors,
          label: t("fabric_length"),
          value: formatFabricLength(lengthCm, locale),
        }
      : null,
  ].filter((r) => r !== null)

  if (rows.length === 0) return null

  return (
    <section
      aria-label={t("fabric_specs_heading")}
      className="bg-muted/40 flex flex-col gap-3 rounded-md border p-4"
    >
      <dl className="grid grid-cols-3 gap-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {lengthCm && widthCm ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("fabric_piece_note", {
            length: formatFabricLength(lengthCm, locale),
            width: formatFabricWidth(widthCm, locale),
          })}
        </p>
      ) : null}
    </section>
  )
}
