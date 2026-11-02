"use client"

import { Search } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import type { Category } from "@workspace/db"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"

import {
  deleteCategoryAction,
  setCategoryProductsAction,
  updateCategoryAction,
} from "@/app/[locale]/admin/(authed)/categories/actions"
import {
  CategoryDetailsFields,
  toCategoryPayload,
  validateCategoryDetails,
  type CategoryDetailsState,
} from "@/components/admin/categories/category-details-form"
import { useSaveBar } from "@/components/admin/save-bar"
import type { Locale } from "@/lib/locale"
import type { PickerProduct } from "@/lib/repos/categories.repo"

type EditorState = {
  details: CategoryDetailsState
  /** Sorted so the dirty check ignores selection order. */
  productIds: string[]
}

function toState(category: Category & { productIds: string[] }): EditorState {
  return {
    details: {
      nameEn: category.nameEn,
      nameAr: category.nameAr,
      slug: category.slug,
      descEn: category.descEn ?? "",
      descAr: category.descAr ?? "",
      isActive: category.isActive,
      showInMenu: category.showInMenu,
    },
    productIds: [...category.productIds].sort(),
  }
}

export function CategoryEditor({
  category,
  products,
  locale,
}: {
  category: Category & { productIds: string[] }
  products: PickerProduct[]
  locale: Locale
}) {
  const t = useTranslations("admin.categories")
  const router = useRouter()
  const initial = useMemo(() => toState(category), [category])
  const [baseline, setBaseline] = useState(initial)
  const [state, setState] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const detailsDirty =
    JSON.stringify(state.details) !== JSON.stringify(baseline.details)
  const productsDirty =
    JSON.stringify(state.productIds) !== JSON.stringify(baseline.productIds)
  const dirty = detailsDirty || productsDirty

  const selected = useMemo(() => new Set(state.productIds), [state.productIds])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (selectedOnly && !selected.has(p.id)) return false
      if (!q) return true
      return (
        p.nameEn.toLowerCase().includes(q) ||
        p.nameAr.includes(q) ||
        p.slug.includes(q)
      )
    })
  }, [products, query, selectedOnly, selected])

  const setProductIds = (ids: Iterable<string>) =>
    setState((s) => ({ ...s, productIds: [...new Set(ids)].sort() }))

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    setProductIds(next)
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id))

  const toggleAllVisible = () => {
    const next = new Set(selected)
    for (const p of visible) {
      if (allVisibleSelected) next.delete(p.id)
      else next.add(p.id)
    }
    setProductIds(next)
  }

  const save = () => {
    if (detailsDirty) {
      const err = validateCategoryDetails(state.details, t)
      if (err) {
        toast.error(err)
        return
      }
    }
    const snapshot = state
    startTransition(async () => {
      if (detailsDirty) {
        const result = await updateCategoryAction(
          category.id,
          toCategoryPayload(snapshot.details),
        )
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setBaseline((b) => ({ ...b, details: snapshot.details }))
      }
      if (productsDirty) {
        const result = await setCategoryProductsAction(
          category.id,
          snapshot.productIds,
        )
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setBaseline((b) => ({ ...b, productIds: snapshot.productIds }))
      }
      toast.success(t("toast.saved"))
      router.refresh()
    })
  }

  const discard = () => setState(baseline)

  useSaveBar(`category-${category.id}`, {
    dirty,
    saving: pending,
    save,
    discard,
  })

  const remove = () => {
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id)
      if (result.ok) {
        toast.success(t("toast.deleted"))
        setConfirmDelete(false)
        router.push(`/${locale}/admin/categories`)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-heading text-xl">{t("sections.details")}</h2>
        <CategoryDetailsFields
          value={state.details}
          onChange={(details) => setState((s) => ({ ...s, details }))}
          // Editing an existing category: never re-derive the slug from the
          // name, so renaming doesn't silently change its URL.
          slugEdited
          onSlugEdited={() => {}}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl">{t("sections.products")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("products.selected_count", {
                count: state.productIds.length,
                total: products.length,
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="category-selected-only"
              checked={selectedOnly}
              onCheckedChange={setSelectedOnly}
            />
            <label htmlFor="category-selected-only" className="text-sm">
              {t("products.selected_only")}
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("products.search_placeholder")}
              className="ps-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAllVisible}
            disabled={visible.length === 0}
          >
            {allVisibleSelected
              ? t("products.clear_visible")
              : t("products.select_visible")}
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="rounded-md border p-12 text-center">
            <p className="text-muted-foreground text-sm">
              {t("products.no_products")}
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-md border p-12 text-center">
            <p className="text-muted-foreground text-sm">
              {t("products.no_match")}
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {visible.map((p) => {
              const on = selected.has(p.id)
              const checkboxId = `cat-product-${p.id}`
              return (
                <li key={p.id}>
                  <label
                    htmlFor={checkboxId}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={on}
                      onCheckedChange={(v) => toggle(p.id, v === true)}
                    />
                    <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded">
                      {p.thumbnailUrl ? (
                        <Image
                          src={p.thumbnailUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {locale === "ar" ? p.nameAr : p.nameEn}
                      </div>
                      <div
                        className="text-muted-foreground truncate font-mono text-xs"
                        dir="ltr"
                      >
                        {p.slug}
                      </div>
                    </div>
                    {!p.isActive ? (
                      <Badge variant="secondary">{t("status.hidden")}</Badge>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="flex justify-end border-t pt-6">
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
        >
          {t("form.delete")}
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>
              {t("delete.body", { count: baseline.productIds.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
            >
              {t("form.cancel")}
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {t("form.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
