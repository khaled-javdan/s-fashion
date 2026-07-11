import type { Metadata } from "next"
import Link from "next/link"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { CheckCircle2, Clock, MessageCircle } from "lucide-react"

import { PaymentMethod, PaymentStatus } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"

import { AdminEditBar } from "@/components/admin-bar/admin-edit-bar"
import { PurchaseTracker } from "./purchase-tracker"
import { StripeReturnCleanup } from "./stripe-return-cleanup"
import { OrderStatusTracker } from "@/components/order/order-status-tracker"
import type { TrackStatus } from "@/components/order/order-tracking-types"
import { Money } from "@/components/currency/money"
import { isCurrencyCode } from "@/lib/currency"
import { reportError } from "@/lib/errors"
import { LOCALES, type Locale } from "@/lib/locale"
import { getOrderByNumber, markOrderPaidBySession } from "@/lib/repos/orders.repo"
import { getSetting } from "@/lib/repos/settings.repo"
import { dispatchOrderNotifications } from "@/lib/services/order-notifications"
import { getStripe, isStripeConfigured } from "@/lib/services/stripe"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>
}): Promise<Metadata> {
  const { locale, orderNumber } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "order" })
  return { title: `${t("order_number")} ${orderNumber}` }
}

/**
 * Order confirmation page. Resolves the order by its human-readable number;
 * `notFound()` when missing. Shows the order number, customer, items, totals,
 * delivery copy, a WhatsApp question button, and a continue-shopping link.
 *
 * Stripe orders land here from the Checkout success redirect with
 * `?session_id=...`. If the webhook hasn't marked the order paid yet, the
 * session is reconciled against Stripe inline (same idempotent repo path), so
 * the customer virtually never sees a stale "processing" state.
 */
export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderNumber: string }>
  searchParams: Promise<{ session_id?: string }>
}) {
  const { locale: rawLocale, orderNumber } = await params
  const { session_id: sessionId } = await searchParams
  if (!hasLocale(LOCALES, rawLocale)) notFound()
  const locale = rawLocale as Locale
  setRequestLocale(locale)

  let order = await getOrderByNumber(orderNumber)
  if (!order) notFound()

  // Webhook-lag reconcile: back from Stripe with the session id, order still
  // PENDING → ask Stripe directly and mark paid through the same idempotent
  // path the webhook uses. Failure here is non-fatal (webhook/cron backstop).
  if (
    order.paymentMethod === PaymentMethod.STRIPE &&
    order.paymentStatus === PaymentStatus.PENDING &&
    sessionId &&
    sessionId === order.stripeSessionId &&
    isStripeConfigured()
  ) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId)
      if (session.payment_status === "paid") {
        const result = await markOrderPaidBySession(
          sessionId,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        )
        if (result.outcome === "paid") {
          void dispatchOrderNotifications(result.orderId).catch((err) =>
            reportError("orderConfirmation.dispatchNotifications", err, {
              orderId: result.orderId,
            }),
          )
        }
        order = (await getOrderByNumber(orderNumber)) ?? order
      }
    } catch (err) {
      reportError("orderConfirmation.stripeReconcile", err, {
        orderNumber,
      })
    }
  }

  const t = await getTranslations("order")

  const isStripe = order.paymentMethod === PaymentMethod.STRIPE
  const isPaid = order.paymentStatus === PaymentStatus.PAID
  // Awaiting payment = Stripe order not yet paid and not cancelled/expired.
  const awaitingPayment = isStripe && !isPaid && order.status === "AWAITING_PAYMENT"
  // Conversion + cart cleanup only once the money is actually in (or COD).
  const confirmed = !isStripe || isPaid

  // Render in the currency captured at order time (display-only snapshot).
  const currency = isCurrencyCode(order.displayCurrency)
    ? order.displayCurrency
    : "AED"
  const rate = order.fxRate

  const whatsappNumber = await getSetting("contact.whatsapp_number")
  const whatsappDigits = (whatsappNumber ?? "").replace(/[^0-9]/g, "")
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
        t("whatsapp_prefill", { orderNumber: order.orderNumber }),
      )}`
    : null

  const addressLine = [
    order.addressLine1,
    order.addressLine2,
    order.city,
  ]
    .filter(Boolean)
    .join("، ")

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      {confirmed ? (
        // GA4 purchase — never for an unpaid/abandoned Stripe order (a visit
        // to this permalink must not count a conversion that didn't happen).
        <PurchaseTracker
          orderNumber={order.orderNumber}
          totalFils={order.totalFils}
          shippingFils={order.shippingFils}
          lines={order.items.map((item) => ({
            variantId: item.variantId,
            nameEn: item.productNameEn,
            unitPriceFils: item.unitPriceFils,
            quantity: item.quantity,
          }))}
        />
      ) : null}
      {isStripe && isPaid && sessionId === order.stripeSessionId ? (
        // Back from Stripe with payment in: clear the cart + saved checkout
        // form that were deliberately kept through the redirect.
        <StripeReturnCleanup orderNumber={order.orderNumber} />
      ) : null}
      <AdminEditBar
        dashboardHref={`/${locale}/admin`}
        editHref={`/${locale}/admin/orders/${order.id}`}
        editLabel="View order"
      />
      <div className="flex flex-col items-center gap-3 text-center">
        {awaitingPayment ? (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Clock className="size-8" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl tracking-wide text-foreground sm:text-3xl">
              {t("awaiting_payment_heading")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("awaiting_payment_subtitle")}
            </p>
          </>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl tracking-wide text-foreground sm:text-3xl">
              {t("success_heading")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("success_subtitle")}</p>
          </>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {t("order_number")}
          </span>
          <span className="font-mono text-lg font-semibold tracking-wider text-foreground">
            {order.orderNumber}
          </span>
        </div>

        <Separator className="my-4" />

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("customer")}
          </p>
          <p className="text-sm text-foreground">{order.customerName}</p>
          <p className="text-sm text-foreground" dir="ltr">
            {order.phone}
          </p>
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("delivery_to")}
          </p>
          <p className="text-sm text-foreground">{addressLine}</p>
        </div>

        <Separator className="my-4" />

        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
          {t("items_heading")}
        </p>
        <ul className="space-y-3">
          {order.items.map((item) => {
            const name =
              locale === "ar" ? item.productNameAr : item.productNameEn
            const colorName =
              locale === "ar" ? item.colorNameAr : item.colorNameEn
            const variantLabel = [colorName, item.size]
              .filter(Boolean)
              .join(" · ")
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {variantLabel ? `${variantLabel} · ` : ""}
                    {t("quantity_short")}: {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums">
                  <Money fils={item.unitPriceFils * item.quantity} locale={locale} currency={currency} rate={rate} />
                </span>
              </li>
            )
          })}
        </ul>

        <Separator className="my-4" />

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span className="tabular-nums">
              <Money fils={order.subtotalFils} locale={locale} currency={currency} rate={rate} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("shipping_fee")}</span>
            <span className="tabular-nums">
              {order.shippingFils === 0
                ? t("shipping_free")
                : <Money fils={order.shippingFils} locale={locale} currency={currency} rate={rate} />}
            </span>
          </div>
          {order.discountFils > 0 ? (
            <div className="flex items-center justify-between font-medium text-emerald-600 dark:text-emerald-500">
              <span>
                {t("discount")}
                {order.couponCode ? (
                  <span className="text-muted-foreground ms-1 font-normal uppercase">
                    ({order.couponCode})
                  </span>
                ) : null}
              </span>
              <span dir="ltr" className="inline-flex items-center gap-0.5 tabular-nums">
                <span aria-hidden="true">−</span>
                <Money fils={order.discountFils} locale={locale} currency={currency} rate={rate} />
              </span>
            </div>
          ) : null}
          <Separator className="my-1" />
          <div className="flex items-center justify-between text-base font-semibold">
            <span>{t("total")}</span>
            <span className="tabular-nums">
              <Money fils={order.totalFils} locale={locale} currency={currency} rate={rate} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("payment_method_label")}
            </span>
            <span className="text-foreground">
              {isStripe
                ? isPaid
                  ? t("payment_method_card_paid")
                  : t("payment_method_card")
                : t("payment_method_cod")}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
          {t("status_heading")}
        </p>
        <OrderStatusTracker
          status={order.status as TrackStatus}
          createdAt={order.createdAt.toISOString()}
          confirmedAt={order.confirmedAt?.toISOString() ?? null}
          shippedAt={order.shippedAt?.toISOString() ?? null}
          deliveredAt={order.deliveredAt?.toISOString() ?? null}
          cancelledAt={order.cancelledAt?.toISOString() ?? null}
          locale={locale}
        />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("expected_delivery")}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {whatsappUrl ? (
          <Button asChild size="lg">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-5" aria-hidden="true" />
              {t("whatsapp_button")}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/${locale}`}>{t("continue_shopping")}</Link>
        </Button>
      </div>
    </section>
  )
}
