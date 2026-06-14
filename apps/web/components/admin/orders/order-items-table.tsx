"use client"

import { useState } from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import type { OrderItemWithImage } from "@/lib/repos/orders.repo"
import {
  Dialog,
  DialogContent,
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

import { formatAed } from "@/lib/money"

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-muted relative size-12 shrink-0 cursor-zoom-in overflow-hidden rounded-md border"
      >
        <Image src={src} alt={alt} fill sizes="48px" className="object-cover" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[90dvh] max-w-sm flex-col gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="relative aspect-[3/4] w-full">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 640px) 90vw, 384px"
              className="object-cover"
              priority
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute end-2 top-2 z-10 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function OrderItemsTable({ items }: { items: OrderItemWithImage[] }) {
  const t = useTranslations("admin.orders")
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16"></TableHead>
            <TableHead>{t("table.item")}</TableHead>
            <TableHead>{t("table.size")}</TableHead>
            <TableHead className="text-end">{t("table.qty")}</TableHead>
            <TableHead className="text-end">{t("table.unit")}</TableHead>
            <TableHead className="text-end">{t("table.total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.imageUrl ? (
                  <ImagePreview src={item.imageUrl} alt={item.productNameEn} />
                ) : (
                  <span
                    className="bg-muted flex size-12 items-center justify-center rounded-md border text-xs font-medium"
                    aria-hidden
                  >
                    {item.productNameEn.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="whitespace-normal font-medium">
                  {item.productNameEn}
                </div>
                {item.colorNameEn ? (
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    {item.colorHex ? (
                      <span
                        className="inline-block size-3 rounded-full border"
                        style={{ backgroundColor: item.colorHex }}
                        aria-hidden
                      />
                    ) : null}
                    {item.colorNameEn}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>{item.size}</TableCell>
              <TableCell className="text-end tabular-nums">
                {item.quantity}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatAed(item.unitPriceFils, "en")}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatAed(item.unitPriceFils * item.quantity, "en")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
