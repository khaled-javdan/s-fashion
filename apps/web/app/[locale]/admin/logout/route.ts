import { NextResponse } from "next/server"

import { signOut } from "@/lib/auth"
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE

  await signOut({ redirect: false })
  return NextResponse.redirect(
    new URL(`/${locale}/admin/login`, request.url),
    // 303 → force browser to GET the redirect target after the POST.
    { status: 303 },
  )
}
