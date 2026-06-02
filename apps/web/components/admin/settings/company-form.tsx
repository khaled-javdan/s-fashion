"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { updateSettingsAction } from "@/app/[locale]/admin/(authed)/settings/actions"
import { useSaveBar } from "@/components/admin/save-bar"

type Props = {
  legalName: string
  tradeLicense: string
  vatTrn: string
}

/**
 * Company & compliance form — the registered name, UAE trade licence number,
 * and VAT TRN surfaced in the storefront footer. Each field may be left blank
 * (hidden in the footer until set). Mirrors the ContactForm save pattern.
 */
export function CompanyForm({ legalName, tradeLicense, vatTrn }: Props) {
  const t = useTranslations("admin.settings")
  // Local baseline; advanced on each successful save (a server action's
  // revalidatePath does not refresh a mounted client form's props).
  const [saved, setSaved] = useState({
    legalName,
    tradeLicense,
    vatTrn,
  })
  const [legalNameValue, setLegalNameValue] = useState(saved.legalName)
  const [tradeLicenseValue, setTradeLicenseValue] = useState(saved.tradeLicense)
  const [vatTrnValue, setVatTrnValue] = useState(saved.vatTrn)
  const [pending, startTransition] = useTransition()

  const dirty =
    legalNameValue !== saved.legalName ||
    tradeLicenseValue !== saved.tradeLicense ||
    vatTrnValue !== saved.vatTrn

  const save = () => {
    const snapshot = {
      legalName: legalNameValue.trim(),
      tradeLicense: tradeLicenseValue.trim(),
      vatTrn: vatTrnValue.trim(),
    }
    startTransition(async () => {
      const results = await Promise.all([
        updateSettingsAction({
          key: "company.legal_name",
          value: snapshot.legalName,
        }),
        updateSettingsAction({
          key: "company.trade_license",
          value: snapshot.tradeLicense,
        }),
        updateSettingsAction({
          key: "company.vat_trn",
          value: snapshot.vatTrn,
        }),
      ])
      const failed = results.find((r) => !r.ok)
      if (failed && !failed.ok) {
        toast.error(failed.error)
      } else {
        setSaved(snapshot)
        setLegalNameValue(snapshot.legalName)
        setTradeLicenseValue(snapshot.tradeLicense)
        setVatTrnValue(snapshot.vatTrn)
        toast.success(t("company.saved_toast"))
      }
    })
  }

  const discard = () => {
    setLegalNameValue(saved.legalName)
    setTradeLicenseValue(saved.tradeLicense)
    setVatTrnValue(saved.vatTrn)
  }

  useSaveBar("settings-company", { dirty, saving: pending, save, discard })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label>{t("company.legal_name_label")}</Label>
        <Input
          value={legalNameValue}
          onChange={(e) => setLegalNameValue(e.target.value)}
          placeholder="S Fashion Trading L.L.C"
        />
        <p className="text-muted-foreground text-xs">
          {t("company.legal_name_help")}
        </p>
      </div>
      <div className="grid gap-2">
        <Label>{t("company.trade_license_label")}</Label>
        <Input
          dir="ltr"
          value={tradeLicenseValue}
          onChange={(e) => setTradeLicenseValue(e.target.value)}
          placeholder="123456"
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          {t("company.trade_license_help")}
        </p>
      </div>
      <div className="grid gap-2">
        <Label>{t("company.vat_trn_label")}</Label>
        <Input
          dir="ltr"
          value={vatTrnValue}
          onChange={(e) => setVatTrnValue(e.target.value)}
          placeholder="100123456700003"
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          {t("company.vat_trn_help")}
        </p>
      </div>
    </form>
  )
}
