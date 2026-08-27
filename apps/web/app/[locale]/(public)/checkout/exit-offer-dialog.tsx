"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, Tag } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

/** A minted last-chance offer: a real single-use code with a real deadline. */
export type ExitOffer = {
  code: string
  percent: number
  /** Epoch millis at which the coupon stops being valid. */
  expiresAtMs: number
}

/** mm:ss left until `targetMs`, or null once it's in the past. */
function useCountdown(targetMs: number | null): string | null {
  const [remaining, setRemaining] = useState(() =>
    targetMs === null ? 0 : targetMs - Date.now(),
  )

  useEffect(() => {
    if (targetMs === null) return
    setRemaining(targetMs - Date.now())
    const id = setInterval(() => setRemaining(targetMs - Date.now()), 1000)
    return () => clearInterval(id)
  }, [targetMs])

  if (targetMs === null || remaining <= 0) return null
  const totalSeconds = Math.floor(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/**
 * Last-chance discount, shown once when the shopper looks like they're leaving
 * the checkout page. The countdown is the coupon's real expiry — accepting
 * applies it to the order in one tap, so there's nothing to copy or retype.
 */
export function ExitOfferDialog({
  offer,
  loading,
  open,
  onOpenChange,
  onAccept,
}: {
  /** The minted offer, or null while it's still being claimed. */
  offer: ExitOffer | null
  loading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: (offer: ExitOffer) => void
}) {
  const t = useTranslations("checkout.exit_offer")
  const countdown = useCountdown(offer?.expiresAtMs ?? null)
  const expired = offer !== null && countdown === null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5 shrink-0 text-primary" aria-hidden="true" />
            {offer ? t("title", { percent: offer.percent }) : t("title_generic")}
          </DialogTitle>
          <DialogDescription>
            {offer && !expired
              ? t("description", { percent: offer.percent })
              : null}
          </DialogDescription>
        </DialogHeader>

        {loading || !offer ? (
          <div className="flex justify-center py-6">
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-center">
            <p
              className="font-mono text-lg font-semibold tracking-widest text-foreground"
              dir="ltr"
            >
              {offer.code}
            </p>
            <p
              className={`mt-1 text-sm font-medium tabular-nums ${
                expired ? "text-muted-foreground" : "text-destructive"
              }`}
              aria-live="polite"
            >
              {countdown ? t("expires_in", { time: countdown }) : t("expired")}
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {t("excludes_shipping")}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("decline")}
          </Button>
          <Button
            type="button"
            disabled={!offer || expired || loading}
            onClick={() => offer && onAccept(offer)}
          >
            {offer ? t("accept", { percent: offer.percent }) : t("accept_generic")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
