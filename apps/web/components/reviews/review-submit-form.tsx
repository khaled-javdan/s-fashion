"use client"

import { CheckCircle2, Star } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { submitProductReviewAction } from "@/app/[locale]/(public)/products/[slug]/actions"
import {
  TurnstileWidget,
  type TurnstileHandle,
} from "@/app/[locale]/(public)/checkout/turnstile-widget"
import type { Locale } from "@/lib/locale"

type Props = {
  productId: string
  locale: Locale
}

/**
 * Customer "Write a review" form (PDP Reviews tab).
 *
 * Client component. Collects a required star rating + name + comment and an
 * optional email, runs the same Turnstile bot guard as checkout, and posts to
 * `submitProductReviewAction`. Submissions are held for admin approval, so on
 * success we swap the form for a "pending approval" confirmation rather than
 * optimistically showing the review.
 */
export function ReviewSubmitForm({ productId, locale }: Props) {
  const t = useTranslations("reviews.form")
  const dir = locale === "ar" ? "rtl" : "ltr"

  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const turnstileRef = useRef<TurnstileHandle>(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side guards mirror the server schema so users get instant feedback.
    if (rating < 1) {
      setError(t("error.rating_required"))
      return
    }
    if (name.trim().length < 2) {
      setError(t("error.name_required"))
      return
    }
    if (body.trim().length < 10) {
      setError(t("error.comment_too_short"))
      return
    }

    startTransition(async () => {
      const res = await submitProductReviewAction({
        productId,
        rating,
        authorName: name.trim(),
        authorEmail: email.trim() || undefined,
        body: body.trim(),
        turnstileToken: turnstileRef.current?.getToken(),
      })
      // Token is single-use — reset for any retry.
      turnstileRef.current?.reset()

      if (res.ok) {
        setDone(true)
        return
      }
      switch (res.code) {
        case "bot":
          setError(t("error.bot"))
          break
        case "product_not_found":
          setError(t("error.product_not_found"))
          break
        case "invalid_request":
          setError(t("error.invalid_request"))
          break
        default:
          setError(t("error.generic"))
      }
    })
  }

  if (done) {
    return (
      <div
        dir={dir}
        className="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border p-8 text-center"
      >
        <CheckCircle2 className="text-primary size-8" aria-hidden="true" />
        <h3 className="font-heading text-lg">{t("success_title")}</h3>
        <p className="text-muted-foreground max-w-sm text-sm">
          {t("success_body")}
        </p>
      </div>
    )
  }

  return (
    <form
      dir={dir}
      onSubmit={onSubmit}
      className="border-border bg-card flex flex-col gap-5 rounded-md border p-5 sm:p-6"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg">{t("heading")}</h3>
        <p className="text-muted-foreground text-sm">{t("subheading")}</p>
      </div>

      {/* Star picker */}
      <div className="flex flex-col gap-2">
        <Label>{t("rating_label")}</Label>
        <div
          className="flex items-center gap-1"
          dir="ltr"
          onMouseLeave={() => setHovered(0)}
          role="radiogroup"
          aria-label={t("rating_label")}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hovered || rating) >= n
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t("rating_value", { count: n })}
                onMouseEnter={() => setHovered(n)}
                onClick={() => setRating(n)}
                className="rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Star
                  className={cn(
                    "size-7 transition-colors",
                    active
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30",
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-name">{t("name_label")}</Label>
          <Input
            id="review-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("name_placeholder")}
            maxLength={80}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-email">{t("email_label")}</Label>
          <Input
            id="review-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("email_placeholder")}
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-body">{t("comment_label")}</Label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("comment_placeholder")}
          rows={4}
          maxLength={2000}
          required
        />
      </div>

      <TurnstileWidget ref={turnstileRef} />

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  )
}
