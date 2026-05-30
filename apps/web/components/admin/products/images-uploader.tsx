"use client"

import { ImagePlus, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"

import {
  deleteProductImageAction,
  uploadProductImageAction,
} from "@/app/[locale]/admin/(authed)/products/actions"

import { ProductImageThumb } from "./product-image-thumb"

export type FormImage = {
  id?: string
  url: string
  altAr?: string | null
  altEn?: string | null
  colorHex?: string | null
  position: number
}

/** A color option an image can be tagged with (sourced from the variants). */
export type ImageColorOption = { hex: string; label: string }

type Props = {
  images: FormImage[]
  onChange: (images: FormImage[]) => void
  /**
   * Append a single freshly-uploaded image. Must be applied as a FUNCTIONAL
   * state update by the parent so a multi-file batch accumulates instead of each
   * upload overwriting the last (and so it composes with AI color tagging).
   */
  onAppend: (image: FormImage) => void
  /** Alt text fallback for newly-uploaded images (product English name). */
  altFallback: string
  /** Colors (from the product's variants) an image can be tagged with. */
  colors: ImageColorOption[]
  /** Fired once per freshly-uploaded image (its Blob URL) for AI analysis. */
  onUploaded?: (url: string) => void
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 8 * 1024 * 1024

export function ImagesUploader({
  images,
  onChange,
  onAppend,
  altFallback,
  colors,
  onUploaded,
}: Props) {
  const t = useTranslations("admin.products")
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(0)

  const reindex = (next: FormImage[]): FormImage[] =>
    next.map((img, idx) => ({ ...img, position: idx }))

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    for (const file of list) {
      if (!ALLOWED.includes(file.type)) {
        toast.error(t("images.error_type", { name: file.name }))
        continue
      }
      if (file.size > MAX_BYTES) {
        toast.error(t("images.error_size", { name: file.name }))
        continue
      }

      setUploading((n) => n + 1)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const result = await uploadProductImageAction(formData)
        if (result.ok) {
          // Functional append (position is fixed by the parent) so a batch of
          // files accumulates instead of each one replacing the previous.
          onAppend({
            url: result.data.url,
            altAr: null,
            altEn: altFallback || null,
            colorHex: null,
            position: 0,
          })
          // Kick off per-image AI analysis (color → variant, global copy).
          onUploaded?.(result.data.url)
        } else {
          toast.error(`${file.name}: ${result.error}`)
        }
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) {
      void uploadFiles(e.dataTransfer.files)
    }
  }

  const removeAt = async (index: number) => {
    const target = images[index]
    const next = reindex(images.filter((_, i) => i !== index))
    onChange(next)
    if (target?.url) {
      // Best-effort delete from Blob; the form state is already updated.
      const result = await deleteProductImageAction(target.url)
      if (!result.ok) {
        toast.error(t("images.error_delete", { error: result.error }))
      }
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(target, 0, moved)
    onChange(reindex(next))
  }

  const setColor = (index: number, hex: string | null) =>
    onChange(
      images.map((img, i) => (i === index ? { ...img, colorHex: hex } : img)),
    )

  return (
    <div className="space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-accent" : "border-input"
        }`}
      >
        {uploading > 0 ? (
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        ) : (
          <ImagePlus className="text-muted-foreground h-6 w-6" />
        )}
        <span className="text-sm font-medium">
          {uploading > 0
            ? t("images.uploading", { count: uploading })
            : t("images.dropzone")}
        </span>
        <span className="text-muted-foreground text-xs">{t("images.hint")}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) {
              void uploadFiles(e.target.files)
              e.target.value = ""
            }
          }}
        />
      </label>

      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {images.map((img, idx) => (
            <ProductImageThumb
              key={img.url}
              url={img.url}
              alt={img.altEn ?? altFallback}
              index={idx}
              total={images.length}
              colors={colors}
              colorHex={img.colorHex ?? null}
              onColorChange={(hex) => setColor(idx, hex)}
              onRemove={() => void removeAt(idx)}
              onMoveUp={() => move(idx, -1)}
              onMoveDown={() => move(idx, 1)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
