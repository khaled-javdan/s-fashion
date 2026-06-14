import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { AutoPrint } from "@/components/admin/orders/auto-print"
import { formatDestination } from "@/components/admin/orders/emirate"
import { formatAed } from "@/lib/money"
import { getOrderById } from "@/lib/repos/orders.repo"

/**
 * Brand palette — identical to the constants in lib/services/resend.ts so the
 * print slip matches the email receipt. Hardcoded hex so iOS Safari never needs
 * to resolve CSS custom-properties during print rendering.
 */
const C = {
  fg: "#1f1916",
  primary: "#946646",
  secondary: "#f3eee6",
  mutedFg: "#6a615b",
  border: "#e4ddd4",
} as const

const sep = (
  <hr
    style={{
      border: "none",
      borderTop: `1px solid ${C.border}`,
      margin: "0",
    }}
  />
)

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: C.mutedFg,
        marginBottom: "6px",
      }}
    >
      {children}
    </div>
  )
}

export default async function OrderPrintPage({
  params,
}: PageProps<"/[locale]/admin/orders/[id]/print">) {
  const { id } = await params
  const t = await getTranslations("admin.orders")

  const order = await getOrderById(id)
  if (!order) notFound()

  const addressLines = [
    order.addressLine1,
    order.addressLine2,
    `${order.city}, ${formatDestination(order.country, order.emirate)}`,
  ].filter(Boolean) as string[]

  return (
    <div style={{ color: C.fg, fontSize: "13px", lineHeight: "1.5" }}>
      <AutoPrint />

      {/* ── Header ──────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: "12px",
          marginBottom: "12px",
          borderBottom: `2px solid ${C.primary}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "0.2em",
              color: C.primary,
              lineHeight: 1,
            }}
          >
            SFASHION
          </div>
          <div style={{ fontSize: "10px", color: C.mutedFg, marginTop: "3px" }}>
            {t("print.hand_off")}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.mutedFg,
            }}
          >
            {t("print.order_number")}
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "20px",
              fontWeight: 700,
              color: C.fg,
              lineHeight: 1.2,
            }}
          >
            {order.orderNumber}
          </div>
        </div>
      </div>

      {/* ── Deliver to ──────────────────────────── */}
      <div style={{ marginBottom: "14px" }}>
        <Label>{t("print.deliver_to")}</Label>
        <div style={{ fontSize: "16px", fontWeight: 700, color: C.fg }}>
          {order.customerName}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "14px",
            color: C.fg,
            margin: "2px 0",
          }}
          dir="ltr"
        >
          {order.phone}
        </div>
        {addressLines.map((line, i) => (
          <div key={i} style={{ color: C.fg }}>
            {line}
          </div>
        ))}
      </div>

      {sep}

      {/* ── Notes ───────────────────────────────── */}
      {order.notes ? (
        <>
          <div style={{ margin: "12px 0" }}>
            <Label>{t("print.notes")}</Label>
            <div style={{ whiteSpace: "pre-wrap", color: C.fg }}>
              {order.notes}
            </div>
          </div>
          {sep}
        </>
      ) : null}

      {/* ── Items ───────────────────────────────── */}
      <div style={{ margin: "12px 0" }}>
        <Label>{t("print.items")}</Label>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${C.border}`,
                color: C.mutedFg,
              }}
            >
              <th
                style={{ textAlign: "left", padding: "4px 0", fontWeight: 600 }}
              >
                {t("table.item")}
              </th>
              <th
                style={{ textAlign: "left", padding: "4px 0", fontWeight: 600 }}
              >
                {t("table.size")}
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "4px 0",
                  fontWeight: 600,
                }}
              >
                {t("table.qty")}
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "4px 0",
                  fontWeight: 600,
                }}
              >
                {t("table.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr
                key={item.id}
                style={{ borderBottom: `1px solid ${C.border}` }}
              >
                <td style={{ padding: "6px 0" }}>
                  <div style={{ fontWeight: 500, color: C.fg }}>
                    {item.productNameEn}
                  </div>
                  {item.colorNameEn ? (
                    <div style={{ fontSize: "11px", color: C.mutedFg }}>
                      {item.colorNameEn}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: "6px 0", color: C.fg }}>{item.size}</td>
                <td
                  style={{
                    padding: "6px 0",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: C.fg,
                  }}
                >
                  {item.quantity}
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: C.fg,
                  }}
                >
                  {formatAed(item.unitPriceFils * item.quantity, "en")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totals ──────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <table
          style={{
            fontSize: "12px",
            borderCollapse: "collapse",
            minWidth: "180px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "3px 0", color: C.mutedFg }}>
                {t("detail.subtotal")}
              </td>
              <td
                style={{
                  padding: "3px 0 3px 24px",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color: C.fg,
                }}
              >
                {formatAed(order.subtotalFils, "en")}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "3px 0", color: C.mutedFg }}>
                {t("detail.shipping")}
              </td>
              <td
                style={{
                  padding: "3px 0 3px 24px",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color: C.fg,
                }}
              >
                {order.shippingFils === 0
                  ? t("detail.free")
                  : formatAed(order.shippingFils, "en")}
              </td>
            </tr>
            {order.discountFils > 0 ? (
              <tr>
                <td style={{ padding: "3px 0", color: C.mutedFg }}>
                  {t("detail.discount")}
                </td>
                <td
                  style={{
                    padding: "3px 0 3px 24px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: C.primary,
                  }}
                >
                  − {formatAed(order.discountFils, "en")}
                </td>
              </tr>
            ) : null}
            <tr>
              <td
                style={{
                  padding: "8px 0 0 0",
                  borderTop: `2px solid ${C.fg}`,
                  fontWeight: 700,
                  fontSize: "14px",
                  color: C.fg,
                }}
              >
                {t("print.collect_cod")}
              </td>
              <td
                style={{
                  padding: "8px 0 0 24px",
                  borderTop: `2px solid ${C.fg}`,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                  fontSize: "14px",
                  color: C.fg,
                }}
              >
                {formatAed(order.totalFils, "en")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────── */}
      <div
        style={{
          marginTop: "16px",
          background: C.secondary,
          borderTop: `1px solid ${C.border}`,
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10px",
          color: C.mutedFg,
        }}
      >
        <span
          style={{
            fontWeight: 800,
            letterSpacing: "0.15em",
            color: C.primary,
          }}
        >
          SFASHION
        </span>
        <span>sfashions.com</span>
      </div>
    </div>
  )
}
