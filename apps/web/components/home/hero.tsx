import { getTranslations } from "next-intl/server"

import { parseHeroConfig, resolveHeroHref } from "@/lib/hero-config"
import { formatMoney } from "@/lib/currency"
import { getCurrencyContext } from "@/lib/currency-context.server"
import type { Locale } from "@/lib/locale"
import type { ProductWithRelations } from "@/lib/repos/products.repo"
import { getSetting } from "@/lib/repos/settings.repo"

import { HeroCarousel, type HeroSlide } from "./hero-carousel"

/** Cap the hero rotation so it stays punchy. */
const MAX_SLIDES = 5

/**
 * Home hero.
 *
 * Renders a full-bleed image carousel built from the catalog's real product
 * imagery (the modern fashion-homepage pattern). Falls back to a compact text
 * hero when no product images are available, so the page never breaks on a
 * fresh/empty database. Server Component — the interactive carousel is a
 * dedicated client leaf.
 */
export async function Hero({
  products,
  locale,
}: {
  products: ProductWithRelations[]
  locale: Locale
}) {
  const t = await getTranslations("home")
  const { currency, rate } = await getCurrencyContext()

  // An admin-configured hero takes precedence over the product carousel.
  const heroConfig = parseHeroConfig(await getSetting("home.hero"))
  if (heroConfig.enabled && heroConfig.slides.length > 0) {
    const heroSlides: HeroSlide[] = heroConfig.slides.map((s, i) => ({
      id: `hero-${i}`,
      href: resolveHeroHref(s.ctaHref, locale) || "#shop",
      imageUrl: s.imageUrl,
      videoUrl: s.videoUrl || undefined,
      posterUrl: s.posterUrl || undefined,
      alt: (locale === "ar" ? s.headlineAr : s.headlineEn) || "S Fashion",
      eyebrow: locale === "ar" ? s.eyebrowAr : s.eyebrowEn,
      title: locale === "ar" ? s.headlineAr : s.headlineEn,
      subtitle: locale === "ar" ? s.subtextAr : s.subtextEn,
      cta: locale === "ar" ? s.ctaLabelAr : s.ctaLabelEn,
      cta2: (locale === "ar" ? s.cta2LabelAr : s.cta2LabelEn) || undefined,
      cta2Href: resolveHeroHref(s.cta2Href, locale) || undefined,
    }))
    return <HeroCarousel slides={heroSlides} isRtl={locale === "ar"} />
  }

  const slides: HeroSlide[] = products
    .filter((p) => p.images.length > 0)
    .slice(0, MAX_SLIDES)
    .map((p) => {
      const image = p.images[0]! // guaranteed by the .filter() above
      const name = locale === "ar" ? p.nameAr : p.nameEn
      return {
        id: p.id,
        href: `/${locale}/products/${p.slug}`,
        imageUrl: image.url,
        alt: (locale === "ar" ? image.altAr : image.altEn) ?? name,
        eyebrow: t("hero_slide_eyebrow"),
        title: name,
        subtitle: formatMoney(p.priceFils, { locale, currency, rate }),
        cta: t("shop_cta"),
      }
    })

  // The first slide uses the brand hero artwork instead of the product photo.
  if (slides[0]) {
    slides[0].imageUrl = "/hero-1.png"
  }

  if (slides.length === 0) {
    return (
      <section className="border-border bg-secondary/40 border-b">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-14 text-center sm:py-20">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.3em] uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-heading text-foreground text-4xl leading-tight tracking-wide text-balance sm:text-6xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground max-w-xl text-base text-balance sm:text-lg">
            {t("hero_tagline")}
          </p>
          <span className="bg-border my-1 h-px w-12" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">{t("social_proof")}</p>
          <a
            href="#shop"
            className="bg-primary text-primary-foreground focus-visible:ring-ring mt-2 inline-flex items-center justify-center rounded-md px-6 py-2.5 text-sm font-semibold tracking-wide transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("shop_cta")}
          </a>
        </div>
      </section>
    )
  }

  return <HeroCarousel slides={slides} isRtl={locale === "ar"} />
}
