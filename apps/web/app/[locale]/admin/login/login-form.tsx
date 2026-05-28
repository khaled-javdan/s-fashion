"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useForm, type Resolver } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

import {
  adminLoginSchema,
  type AdminLoginInput,
} from "@/lib/schemas/admin-login.schema"
import type { Locale } from "@/lib/locale"

// Small inline Zod resolver. Avoids `@hookform/resolvers/zod` because the
// published resolver types lag behind zod 4.4's runtime types (the
// `_zod.version.minor` literal moved from 0 → 4), causing a type-only
// mismatch on the resolver overloads. Calling `safeParse` directly is the
// most stable path and keeps Zod as the single source of validation truth.
const loginResolver: Resolver<AdminLoginInput> = async (values) => {
  const parsed = adminLoginSchema.safeParse(values)
  if (parsed.success) {
    return { values: parsed.data, errors: {} }
  }
  const fieldErrors: Record<string, { type: string; message: string }> = {}
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".") || "root"
    if (!fieldErrors[path]) {
      fieldErrors[path] = {
        type: issue.code ?? "validation",
        message: issue.message,
      }
    }
  }
  return { values: {}, errors: fieldErrors }
}

type Props = {
  locale: Locale
}

export function LoginForm({ locale }: Props) {
  const t = useTranslations("admin.login")
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginInput>({
    resolver: loginResolver,
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: AdminLoginInput) => {
    setServerError(null)
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (!result || result.error) {
      setServerError(t("error_invalid"))
      return
    }

    router.push(`/${locale}/admin`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("error_title")}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="admin-email">{t("email_label")}</Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-destructive text-sm font-medium">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="admin-password">{t("password_label")}</Label>
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-destructive text-sm font-medium">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  )
}
