"use client"

import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import type { Size } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

import { analyzeImageAction } from "@/app/[locale]/admin/(authed)/ai/actions"
import {
  createProductAction,
  updateProductAction,
  toggleProductActiveAction,
  type ProductFormPayload,
} from "@/app/[locale]/admin/(authed)/products/actions"
import { AiSuggestionBadge } from "@/components/admin/ai/ai-suggestion-badge"
import { AiTranslatePairButton } from "@/components/admin/ai/ai-translate-pair-button"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { useSaveBar } from "@/components/admin/save-bar"
import {
  ImagesUploader,
  type FormImage,
} from "@/components/admin/products/images-uploader"
import {
  VariantsEditor,
  makeEmptyVariant,
  type FormVariant,
} from "@/components/admin/products/variants-editor"
import { filsToAed } from "@/lib/money"
import type { Locale } from "@/lib/locale"
import type { ProductWithRelations } from "@/lib/repos/products.repo"

type Props =
  | { mode: "create"; locale: Locale; product?: undefined }
  | { mode: "edit"; locale: Locale; product: ProductWithRelations }

type FormState = {
  slug: string
  nameAr: string
  nameEn: string
  descAr: string
  descEn: string
  additionalInfoAr: string
  additionalInfoEn: string
  priceAed: string
  compareAtAed: string
  costPriceAed: string
  isFinalSale: boolean
  isActive: boolean
  variants: FormVariant[]
  images: FormImage[]
}

/** Suggestion shape returned by the AI analyze panel (subset applied below). */
type Suggestions = Record<string, unknown>

function initialState(product?: ProductWithRelations): FormState {
  if (!product) {
    return {
      slug: "",
      nameAr: "",
      nameEn: "",
      descAr: "",
      descEn: "",
      additionalInfoAr: "",
      additionalInfoEn: "",
      priceAed: "",
      compareAtAed: "",
      costPriceAed: "",
      isFinalSale: false,
      isActive: true,
      variants: [makeEmptyVariant()],
      images: [],
    }
  }
  return {
    slug: product.slug,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    descAr: product.descAr ?? "",
    descEn: product.descEn ?? "",
    additionalInfoAr: product.additionalInfoAr ?? "",
    additionalInfoEn: product.additionalInfoEn ?? "",
    priceAed: String(filsToAed(product.priceFils)),
    compareAtAed:
      product.compareAtFils != null ? String(filsToAed(product.compareAtFils)) : "",
    costPriceAed:
      product.costPriceFils != null ? String(filsToAed(product.costPriceFils)) : "",
    isFinalSale: product.isFinalSale,
    isActive: product.isActive,
    variants: product.variants.map((v) => ({
      id: v.id,
      colorNameAr: v.colorNameAr ?? "",
      colorNameEn: v.colorNameEn ?? "",
      colorHex: v.colorHex ?? "#000000",
      size: v.size as Size,
      stock: v.stock,
      sku: v.sku ?? "",
    })),
    images: product.images.map((i) => ({
      id: i.id,
      url: i.url,
      altAr: i.altAr,
      altEn: i.altEn,
      colorHex: i.colorHex,
      position: i.position,
    })),
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const DEFAULT_HEX = "#C97B84"
const isEmpty = (v?: string | null) => !v || v.trim() === ""
const validHex = (h?: string | null): string | null =>
  typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h) ? h : null

type VariantSuggestion = {
  colorNameEn?: string
  colorNameAr?: string
  colorHex?: string
}

export function ProductForm(props: Props) {
  const { mode, locale } = props
  const t = useTranslations("admin.products")
  const router = useRouter()
  const initial = useMemo(() => initialState(props.product), [props.product])
  // Local baseline the form diffs against. Seeded from props, then advanced on
  // each successful save — a server action's revalidatePath/refresh re-derives
  // props (e.g. "30.00" → "30"), which must not read back as unsaved changes.
  const [baseline, setBaseline] = useState<FormState>(initial)
  const [state, setState] = useState<FormState>(initial)
  const [slugEdited, setSlugEdited] = useState(mode === "edit")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dirty = JSON.stringify(state) !== JSON.stringify(baseline)

  // Fields populated by AI suggestions, badged until the admin edits them.
  const [aiFields, setAiFields] = useState<Set<string>>(new Set())
  const clearAi = (key: string) =>
    setAiFields((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const onNameEnChange = (value: string) => {
    setState((s) => ({
      ...s,
      nameEn: value,
      slug: slugEdited ? s.slug : slugify(value),
    }))
    clearAi("nameEn")
    if (!slugEdited) clearAi("slug")
  }

  // Latest state for async AI callbacks (analysis resolves after re-renders).
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  // Number of in-flight per-image analyses (color detection + global copy).
  const [analyzing, setAnalyzing] = useState(0)

  // Distinct variant colors an image can be tagged with (label prefers the
  // English color name, then Arabic, then the hex itself).
  const imageColors = useMemo(() => {
    const seen = new Set<string>()
    const out: { hex: string; label: string }[] = []
    for (const v of state.variants) {
      const hex = v.colorHex
      if (!hex || seen.has(hex)) continue
      seen.add(hex)
      out.push({
        hex,
        label: v.colorNameEn?.trim() || v.colorNameAr?.trim() || hex,
      })
    }
    return out
  }, [state.variants])

  /**
   * Analyze one freshly-uploaded image and fold the result into the form:
   * detect its colour and ensure a matching variant (tagging the image to it),
   * and fill the GLOBAL name/description/slug only while they're still empty —
   * so the first image seeds the copy and later images just add colours without
   * clobbering anything the admin typed.
   */
  const applyImageAnalysis = (url: string, s: Suggestions) => {
    const str = (k: string): string | null => {
      const v = s[k]
      return typeof v === "string" && v.trim() !== "" ? v.trim() : null
    }
    const sv = Array.isArray(s.variants)
      ? (s.variants[0] as VariantSuggestion | undefined)
      : undefined
    const hex = validHex(sv?.colorHex)
    const colorEn = sv?.colorNameEn?.trim() ?? ""
    const colorAr = sv?.colorNameAr?.trim() ?? ""
    const nameEn = str("nameEn")
    const nameAr = str("nameAr")
    const descEn = str("descEn")
    const descAr = str("descAr")
    const additionalInfoEn = str("additionalInfoEn")
    const additionalInfoAr = str("additionalInfoAr")
    const aiSlug = str("slug")

    // Flag which global fields this image actually fills (badge until edited).
    // Read from the ref so concurrent analyses see the freshest emptiness.
    const cur = stateRef.current
    const flags: string[] = []
    if (isEmpty(cur.nameEn) && nameEn) flags.push("nameEn")
    if (isEmpty(cur.nameAr) && nameAr) flags.push("nameAr")
    if (isEmpty(cur.descEn) && descEn) flags.push("descEn")
    if (isEmpty(cur.descAr) && descAr) flags.push("descAr")
    if (isEmpty(cur.additionalInfoEn) && additionalInfoEn)
      flags.push("additionalInfoEn")
    if (isEmpty(cur.additionalInfoAr) && additionalInfoAr)
      flags.push("additionalInfoAr")
    if (isEmpty(cur.slug) && (aiSlug || nameEn)) flags.push("slug")

    // Functional update so simultaneous image analyses compose correctly.
    setState((prev) => {
      const next: FormState = { ...prev }

      if (isEmpty(next.nameEn) && nameEn) next.nameEn = nameEn
      if (isEmpty(next.nameAr) && nameAr) next.nameAr = nameAr
      if (isEmpty(next.descEn) && descEn) next.descEn = descEn
      if (isEmpty(next.descAr) && descAr) next.descAr = descAr
      if (isEmpty(next.additionalInfoEn) && additionalInfoEn)
        next.additionalInfoEn = additionalInfoEn
      if (isEmpty(next.additionalInfoAr) && additionalInfoAr)
        next.additionalInfoAr = additionalInfoAr
      if (isEmpty(next.slug)) {
        if (aiSlug) next.slug = slugify(aiSlug)
        else if (!isEmpty(next.nameEn)) next.slug = slugify(next.nameEn)
      }

      if (hex) {
        const sameColor = next.variants.findIndex(
          (v) => (v.colorHex ?? "").toLowerCase() === hex.toLowerCase(),
        )
        if (sameColor === -1) {
          // Reuse the untouched seeded default variant for the first colour,
          // otherwise append a new colour variant (size copied from the first).
          const blank = next.variants.findIndex(
            (v) =>
              !v.id &&
              (!v.colorHex || v.colorHex === DEFAULT_HEX) &&
              isEmpty(v.colorNameEn) &&
              isEmpty(v.colorNameAr),
          )
          const patch = { colorNameEn: colorEn, colorNameAr: colorAr, colorHex: hex }
          if (blank !== -1) {
            next.variants = next.variants.map((v, i) =>
              i === blank ? { ...v, ...patch } : v,
            )
          } else {
            const baseSize = next.variants[0]?.size ?? "M"
            next.variants = [
              ...next.variants,
              { ...makeEmptyVariant(), size: baseSize, ...patch },
            ]
          }
        }
        // Tag this image with the detected colour for the storefront gallery.
        next.images = next.images.map((img) =>
          img.url === url ? { ...img, colorHex: hex } : img,
        )
      }

      return next
    })

    if (flags.includes("slug")) setSlugEdited(true)
    if (flags.length > 0) {
      setAiFields((prev) => new Set([...prev, ...flags]))
    }
  }

  /** Fire analysis for a just-uploaded image; errors surface as a toast. */
  const analyzeUploadedImage = (url: string) => {
    setAnalyzing((n) => n + 1)
    analyzeImageAction({
      imageUrls: [url],
      context: "product",
      schemaDescriptor: "product-suggestions-v3",
    })
      .then((res) => {
        if (res.ok) applyImageAnalysis(url, res.suggestions)
        else toast.error(res.error)
      })
      .catch(() => toast.error(t("ai.analyze_error")))
      .finally(() => setAnalyzing((n) => Math.max(0, n - 1)))
  }

  const validate = (): string | null => {
    if (state.nameEn.trim().length < 1) return t("validation.name_en_required")
    if (state.nameAr.trim().length < 1) return t("validation.name_ar_required")
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.slug))
      return t("validation.slug_invalid")
    const price = Number(state.priceAed)
    if (!Number.isFinite(price) || price < 0)
      return t("validation.price_invalid")
    if (state.compareAtAed.trim() !== "") {
      const cmp = Number(state.compareAtAed)
      if (!Number.isFinite(cmp) || cmp < 0)
        return t("validation.compare_at_invalid")
    }
    if (state.variants.length < 1) return t("validation.variants_required")
    const seen = new Set<string>()
    for (const v of state.variants) {
      const key = `${(v.colorHex ?? "").toLowerCase()}::${v.size}`
      if (seen.has(key)) return t("validation.variant_unique")
      seen.add(key)
    }
    return null
  }

  const buildPayload = (): ProductFormPayload => ({
    slug: state.slug.trim(),
    nameAr: state.nameAr.trim(),
    nameEn: state.nameEn.trim(),
    descAr: state.descAr.trim() || null,
    descEn: state.descEn.trim() || null,
    additionalInfoAr: state.additionalInfoAr.trim() || null,
    additionalInfoEn: state.additionalInfoEn.trim() || null,
    priceAed: Number(state.priceAed),
    compareAtAed:
      state.compareAtAed.trim() === "" ? null : Number(state.compareAtAed),
    costPriceAed:
      state.costPriceAed.trim() === "" ? null : Number(state.costPriceAed),
    isActive: state.isActive,
    isFinalSale: state.isFinalSale,
    variants: state.variants.map((v) => ({
      id: v.id,
      colorNameAr: v.colorNameAr?.trim() || null,
      colorNameEn: v.colorNameEn?.trim() || null,
      colorHex: v.colorHex || null,
      size: v.size,
      stock: v.stock,
      sku: v.sku?.trim() || null,
    })),
    images: state.images.map((i, idx) => ({
      id: i.id,
      url: i.url,
      altAr: i.altAr ?? null,
      altEn: i.altEn ?? null,
      colorHex: i.colorHex ?? null,
      position: idx,
    })),
  })

  const save = () => {
    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      toast.error(validationError)
      return
    }
    const payload = buildPayload()
    const snapshot = state
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProductAction(payload)
          : await updateProductAction(props.product.id, payload)

      if (result.ok) {
        toast.success(
          mode === "create" ? t("toast.created") : t("toast.saved"),
        )
        if (mode === "create") {
          router.push(`/${locale}/admin/products/${result.data.id}`)
        } else {
          // Advance the baseline so the just-saved values read as clean even
          // though the server re-derives props (e.g. normalised numbers).
          setBaseline(snapshot)
          router.refresh()
        }
      } else {
        setError(result.error)
        toast.error(result.error)
      }
    })
  }

  const discard = () => {
    setState(baseline)
    setError(null)
    setAiFields(new Set())
  }

  // In create mode "dirty" is whatever was typed; in edit mode it's a diff
  // against the loaded product. Either way the save bar drives the save.
  useSaveBar(
    `product-${mode === "edit" ? props.product.id : "new"}`,
    { dirty, saving: pending, save, discard },
  )

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  const onToggleActive = () => {
    if (mode !== "edit") return
    startTransition(async () => {
      const result = await toggleProductActiveAction(props.product.id)
      if (result.ok) {
        // Active toggles persist immediately, so move the baseline with it —
        // otherwise it would surface as a phantom unsaved change.
        set("isActive", result.data.isActive)
        setBaseline((b) => ({ ...b, isActive: result.data.isActive }))
        toast.success(
          result.data.isActive ? t("toast.restored") : t("toast.hidden"),
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const aiBadge = (key: string) =>
    aiFields.has(key) ? <AiSuggestionBadge /> : null

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Images first: each upload is auto-analyzed — its colour becomes a
          variant and global copy is filled while empty. No analysis runs just
          from opening an existing product; only fresh uploads trigger it. */}
      <Section title={t("sections.images")}>
        <ImagesUploader
          images={state.images}
          onChange={(images) => set("images", images)}
          onAppend={(image) =>
            setState((s) => ({
              ...s,
              images: [...s.images, { ...image, position: s.images.length }],
            }))
          }
          altFallback={state.nameEn}
          colors={imageColors}
          onUploaded={analyzeUploadedImage}
        />
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          {analyzing > 0
            ? t("ai.analyzing", { count: analyzing })
            : t("ai.hint")}
        </p>
      </Section>

      <Section title={t("sections.basics")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("form.name_en")}
            badge={aiBadge("nameEn")}
            action={
              <AiTranslatePairButton
                valueEn={state.nameEn}
                valueAr={state.nameAr}
                context="product-name"
                onResult={(lang, t) => {
                  if (lang === "en") {
                    onNameEnChange(t)
                  } else {
                    set("nameAr", t)
                    clearAi("nameAr")
                  }
                }}
              />
            }
          >
            <Input
              value={state.nameEn}
              onChange={(e) => onNameEnChange(e.target.value)}
              required
            />
          </Field>
          <Field label={t("form.name_ar")} badge={aiBadge("nameAr")}>
            <Input
              dir="rtl"
              value={state.nameAr}
              onChange={(e) => {
                set("nameAr", e.target.value)
                clearAi("nameAr")
              }}
              required
            />
          </Field>
          <Field label={t("form.slug")} badge={aiBadge("slug")}>
            <Input
              value={state.slug}
              onChange={(e) => {
                setSlugEdited(true)
                set("slug", e.target.value)
                clearAi("slug")
              }}
              className="font-mono text-sm"
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("form.desc_en")}
            badge={aiBadge("descEn")}
            action={
              <AiTranslatePairButton
                valueEn={state.descEn}
                valueAr={state.descAr}
                context="product-description"
                onResult={(lang, t) => {
                  if (lang === "en") {
                    set("descEn", t)
                    clearAi("descEn")
                  } else {
                    set("descAr", t)
                    clearAi("descAr")
                  }
                }}
              />
            }
          >
            <RichTextEditor
              value={state.descEn}
              ariaLabel={t("form.desc_en")}
              onChange={(html) => {
                set("descEn", html)
                clearAi("descEn")
              }}
            />
          </Field>
          <Field label={t("form.desc_ar")} badge={aiBadge("descAr")}>
            <RichTextEditor
              value={state.descAr}
              dir="rtl"
              ariaLabel={t("form.desc_ar")}
              onChange={(html) => {
                set("descAr", html)
                clearAi("descAr")
              }}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("form.additional_info_en")}
            badge={aiBadge("additionalInfoEn")}
            action={
              <AiTranslatePairButton
                valueEn={state.additionalInfoEn}
                valueAr={state.additionalInfoAr}
                context="product-description"
                onResult={(lang, translation) => {
                  if (lang === "en") {
                    set("additionalInfoEn", translation)
                    clearAi("additionalInfoEn")
                  } else {
                    set("additionalInfoAr", translation)
                    clearAi("additionalInfoAr")
                  }
                }}
              />
            }
          >
            <RichTextEditor
              value={state.additionalInfoEn}
              ariaLabel={t("form.additional_info_en")}
              onChange={(html) => {
                set("additionalInfoEn", html)
                clearAi("additionalInfoEn")
              }}
            />
          </Field>
          <Field
            label={t("form.additional_info_ar")}
            badge={aiBadge("additionalInfoAr")}
          >
            <RichTextEditor
              value={state.additionalInfoAr}
              dir="rtl"
              ariaLabel={t("form.additional_info_ar")}
              onChange={(html) => {
                set("additionalInfoAr", html)
                clearAi("additionalInfoAr")
              }}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.price")}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={state.priceAed}
              onChange={(e) => set("priceAed", e.target.value)}
              required
            />
          </Field>
          <Field label={t("form.compare_at")}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={state.compareAtAed}
              onChange={(e) => set("compareAtAed", e.target.value)}
            />
          </Field>
          <Field label={t("form.cost_price")}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={state.costPriceAed}
              onChange={(e) => set("costPriceAed", e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-6">
          <ToggleRow
            label={t("form.final_sale")}
            description={t("form.final_sale_desc")}
            checked={state.isFinalSale}
            onChange={(v) => set("isFinalSale", v)}
          />
          <ToggleRow
            label={t("form.active")}
            description={t("form.active_desc")}
            checked={state.isActive}
            onChange={(v) => set("isActive", v)}
          />
        </div>
      </Section>

      <Section title={t("sections.variants")}>
        <VariantsEditor
          variants={state.variants}
          onChange={(variants) => set("variants", variants)}
        />
      </Section>

      {error ? (
        <p className="text-destructive text-sm font-medium">{error}</p>
      ) : null}

      {mode === "edit" ? (
        <div className="flex items-center justify-end gap-4 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onToggleActive}
            disabled={pending}
          >
            {state.isActive ? t("form.hide") : t("form.restore")}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-xl">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  action,
  badge,
  children,
}: {
  label: string
  action?: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  // `flex flex-col` (not `grid`) so when this Field sits in a two-column row
  // and the sibling Field grows tall, the shorter side stays anchored to the
  // top instead of letting its label / editor drift toward the middle.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch checked={checked} onCheckedChange={onChange} />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
    </div>
  )
}
