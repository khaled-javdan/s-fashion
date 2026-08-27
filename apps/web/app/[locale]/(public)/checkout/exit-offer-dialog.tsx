"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Tag } from "lucide-react"

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
function useCountdown(targetMs: number): string | null {
  const [remaining, setRemaining] = useState(() => targetMs - Date.now())

  useEffect(() => {
    setRemaining(targetMs - Date.now())
    const id = setInterval(() => setRemaining(targetMs - Date.now()), 1000)
    return () => clearInterval(id)
  }, [targetMs])

  if (remaining <= 0) return null
  const totalSeconds = Math.floor(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/**
 * Last-chance discount, shown once when the shopper looks like they're leaving
 * the checkout page. The countdown is the coupon's real expiry — accepting
 * applies it to the order in one tap, so there's nothing to copy or retype.
 *
 * Only ever rendered with a code already in hand: the caller claims first and
 * mounts this second, so a basket that doesn't qualify (below the shop's
 * threshold, or the offer switched off) simply never sees a dialog rather than
 * one that appears and vanishes.
 */
export function ExitOfferDialog({
  offer,
  open,
  onOpenChange,
  onAccept,
}: {
  offer: ExitOffer
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: (offer: ExitOffer) => void
}) {
  const t = useTranslations("checkout.exit_offer")
  const countdown = useCountdown(offer.expiresAtMs)
  const expired = countdown === null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5 shrink-0 text-primary" aria-hidden="true" />
            {t("title", { percent: offer.percent })}
          </DialogTitle>
          <DialogDescription>
            {expired ? null : t("description", { percent: offer.percent })}
          </DialogDescription>
        </DialogHeader>

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
            disabled={expired}
            onClick={() => onAccept(offer)}
          >
            {t("accept", { percent: offer.percent })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
