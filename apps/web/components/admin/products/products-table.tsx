"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { toggleProductActiveAction } from "@/app/[locale]/admin/(authed)/products/actions"
import { formatAed } from "@/lib/money"
import type { Locale } from "@/lib/locale"

export type ProductRow = {
  id: string
  nameEn: string
  nameAr: string
  slug: string
  priceFils: number
  isActive: boolean
  totalStock: number
  thumbnailUrl: string | null
  thumbnailAlt: string
}

type Props = {
  products: ProductRow[]
  locale: Locale
}

export function ProductsTable({ products, locale }: Props) {
  const t = useTranslations("admin.products")

  if (products.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground text-sm">{t("list.empty")}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">{t("table.image")}</TableHead>
            <TableHead>{t("table.name")}</TableHead>
            <TableHead className="text-end">{t("table.price")}</TableHead>
            <TableHead className="text-end">{t("table.stock")}</TableHead>
            <TableHead className="w-28 text-center">{t("table.active")}</TableHead>
            <TableHead className="w-20 text-end">{t("table.edit")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <ProductTableRow key={p.id} product={p} locale={locale} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ProductTableRow({
  product,
  locale,
}: {
  product: ProductRow
  locale: Locale
}) {
  const t = useTranslations("admin.products")
  const [isActive, setIsActive] = useState(product.isActive)
  const [pending, startTransition] = useTransition()

  const onToggle = () => {
    startTransition(async () => {
      const result = await toggleProductActiveAction(product.id)
      if (result.ok) {
        setIsActive(result.data.isActive)
        toast.success(
          result.data.isActive
            ? t("toast.now_visible")
            : t("toast.now_hidden"),
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <TableRow>
      <TableCell>
        <div className="bg-muted relative h-12 w-12 overflow-hidden rounded-md">
          {product.thumbnailUrl ? (
            <Image
              src={product.thumbnailUrl}
              alt={product.thumbnailAlt}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{product.nameEn}</div>
        <div className="text-muted-foreground text-xs" dir="rtl">
          {product.nameAr}
        </div>
        <div className="text-muted-foreground text-xs">/{product.slug}</div>
      </TableCell>
      <TableCell className="text-end tabular-nums">
        {formatAed(product.priceFils, locale)}
      </TableCell>
      <TableCell className="text-end tabular-nums">
        {product.totalStock === 0 ? (
          <Badge variant="destructive">{t("table.out_of_stock")}</Badge>
        ) : (
          product.totalStock
        )}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={isActive}
          onCheckedChange={onToggle}
          disabled={pending}
          aria-label={t("table.toggle_active")}
        />
      </TableCell>
      <TableCell className="text-end">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/admin/products/${product.id}`}>
            {t("table.edit")}
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}
