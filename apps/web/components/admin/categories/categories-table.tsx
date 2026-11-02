"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  createCategoryAction,
  reorderCategoriesAction,
} from "@/app/[locale]/admin/(authed)/categories/actions"
import {
  CategoryDetailsFields,
  validateCategoryDetails,
  type CategoryDetailsState,
} from "@/components/admin/categories/category-details-form"
import type { Locale } from "@/lib/locale"
import type { CategoryWithCount } from "@/lib/repos/categories.repo"

const EMPTY: CategoryDetailsState = {
  nameEn: "",
  nameAr: "",
  slug: "",
  isActive: true,
}

export function CategoriesTable({
  categories,
  locale,
}: {
  categories: CategoryWithCount[]
  locale: Locale
}) {
  const t = useTranslations("admin.categories")
  const router = useRouter()
  const [order, setOrder] = useState(categories)
  const [syncedFrom, setSyncedFrom] = useState(categories)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<CategoryDetailsState>(EMPTY)
  const [slugEdited, setSlugEdited] = useState(false)
  const [pending, startTransition] = useTransition()

  // Re-sync local order when the server sends a fresh list (after refresh).
  if (syncedFrom !== categories) {
    setSyncedFrom(categories)
    setOrder(categories)
  }

  const openCreate = () => {
    setDraft(EMPTY)
    setSlugEdited(false)
    setCreating(true)
  }

  const create = () => {
    const err = validateCategoryDetails(draft, t)
    if (err) {
      toast.error(err)
      return
    }
    startTransition(async () => {
      const result = await createCategoryAction({
        nameEn: draft.nameEn.trim(),
        nameAr: draft.nameAr.trim(),
        slug: draft.slug.trim(),
        isActive: draft.isActive,
      })
      if (result.ok) {
        toast.success(t("toast.created"))
        // Straight to the category so the admin can add its products.
        router.push(`/${locale}/admin/categories/${result.data.id}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item!)
    const previous = order
    setOrder(next)
    startTransition(async () => {
      const result = await reorderCategoriesAction(next.map((c) => c.id))
      if (!result.ok) {
        setOrder(previous)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>{t("list.new")}</Button>
      </div>

      {order.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <p className="text-muted-foreground text-sm">{t("list.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">{t("table.order")}</TableHead>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.slug")}</TableHead>
                <TableHead className="text-end">{t("table.products")}</TableHead>
                <TableHead className="text-center">{t("table.status")}</TableHead>
                <TableHead className="text-end">{t("table.edit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={pending || i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={t("table.move_up")}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={pending || i === order.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={t("table.move_down")}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${locale}/admin/categories/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {locale === "ar" ? c.nameAr : c.nameEn}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {locale === "ar" ? c.nameEn : c.nameAr}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs" dir="ltr">
                      {c.slug}
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {c.productCount}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={c.isActive ? "default" : "secondary"}>
                      {c.isActive ? t("status.active") : t("status.hidden")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${locale}/admin/categories/${c.id}`}>
                        {t("table.edit")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl tracking-wide">
              {t("form.create_title")}
            </DialogTitle>
          </DialogHeader>
          <CategoryDetailsFields
            value={draft}
            onChange={setDraft}
            slugEdited={slugEdited}
            onSlugEdited={() => setSlugEdited(true)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreating(false)}
              disabled={pending}
            >
              {t("form.cancel")}
            </Button>
            <Button onClick={create} disabled={pending}>
              {t("form.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
