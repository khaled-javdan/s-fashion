# S Fashion — Engineering Spec (Round 1)

> Single source of truth for the v1 build. Read this before writing any code.
> If something here conflicts with another doc, this wins.

---

## 0. Purpose & North Star

S Fashion is a UAE-based mukhawar (traditional Arabic ladies' dress) brand with an existing audience: ~160k Instagram followers, ~40k TikTok, and a physical booth at Global Village. Today they take orders manually via Instagram DMs. **The website's job is to be the link-in-bio that turns "DM us for price" into "tap, order, done" in under 90 seconds, from inside an Instagram in-app browser, in Arabic, on a phone.**

The site is an **operations tool** before it is a marketing tool. Traffic is not the bottleneck — order capture is. Design and engineering decisions should bias toward:

- **Mobile-first** (~95% of traffic will be mobile in-app browsers)
- **Arabic-first** (RTL native, English as a toggle)
- **Speed at checkout** (no accounts, no friction, OTP-verified COD)
- **Operational notification flow** (the team must know an order landed within seconds)
- **Trust signals** (real domain, clear policies, WhatsApp button, real photos)

**Out of scope for v1** (do not build): customer accounts, wishlist, reviews, search/filters, promo codes, abandoned cart, Tabby/Tamara/card payments, multi-warehouse, email marketing. These are v1.5+.

---

## 1. Tech Stack (locked)

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript strict |
| Styling | Tailwind v4 + shadcn/ui (workspace package `@workspace/ui`) |
| i18n | `next-intl`, locale-prefixed routes (`/ar`, `/en`), Arabic default |
| Forms | `react-hook-form` + `zod` (single schema, client + server) |
| Server state (admin) | `@tanstack/react-query` |
| Cart state | `zustand` with `persist` middleware (localStorage) |
| DB | PostgreSQL on Neon (Vercel Marketplace integration) |
| ORM | Prisma (in workspace package `@workspace/db`) |
| Admin auth | NextAuth (Auth.js v5) Credentials provider + bcrypt + `@auth/prisma-adapter` |
| Customer auth | None — guest checkout. Phone OTP per order via Twilio Verify |
| Image storage | Vercel Blob |
| Email (transactional) | Resend |
| Team notifications | Telegram Bot API |
| Analytics | Vercel Analytics, Vercel Speed Insights, Meta Pixel, TikTok Pixel |
| Deploy | Vercel |
| Package manager | pnpm 10 |
| Build orchestration | Turborepo |

> **⚠ Next.js 16 has breaking changes vs. earlier versions.** Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Do not assume older API shapes.

---

## 2. Repository Layout (target state after Round 1)

```
s-fashion/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── [locale]/              # localized public + customer routes
│       │   │   ├── layout.tsx         # sets dir, loads messages
│       │   │   ├── page.tsx           # (Round 2 — Track E)
│       │   │   └── ...
│       │   ├── admin/                 # English-only, behind auth
│       │   │   ├── layout.tsx         # auth gate (server)
│       │   │   ├── login/page.tsx     # public login
│       │   │   └── page.tsx           # placeholder dashboard
│       │   ├── api/
│       │   │   └── auth/[...nextauth]/route.ts
│       │   ├── layout.tsx             # root html/body, fonts
│       │   └── globals.css (re-exported from @workspace/ui)
│       ├── components/
│       │   ├── layout/                # header, footer, whatsapp-float, locale-switcher
│       │   ├── analytics/             # meta-pixel, tiktok-pixel, cookie-banner
│       │   └── theme-provider.tsx     # (existing)
│       ├── lib/
│       │   ├── auth.ts                # NextAuth config
│       │   ├── locale.ts              # locale helpers
│       │   ├── money.ts               # fils <-> AED, formatters
│       │   ├── repos/                 # data-access functions (built atop @workspace/db)
│       │   ├── services/              # twilio, telegram, resend, blob, pixels wrappers
│       │   └── schemas/               # shared zod schemas
│       ├── messages/
│       │   ├── ar.json
│       │   └── en.json
│       ├── scripts/
│       │   └── create-admin.ts        # one-off admin user creation
│       ├── i18n.ts                    # next-intl request config
│       ├── middleware.ts              # i18n routing only (no auth)
│       └── next.config.ts
├── packages/
│   ├── db/                            # NEW: Prisma client + schema + types
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   └── index.ts               # exports prisma client + types
│   │   └── package.json
│   ├── ui/                            # shadcn components (existing)
│   ├── eslint-config/                 # existing
│   └── typescript-config/             # existing
├── .env.example
├── SPEC.md                            # this file
└── AGENTS.md
```

---

## 3. Engineering Conventions (non-negotiable)

**Money.** All money is stored and passed around as **integer fils** (1 AED = 100 fils). Never floats. Formatting (e.g. "AED 250.00") happens only at the rendering edge via `lib/money.ts`. Database columns end in `Fils`; in-memory variable names end in `Fils` (`subtotalFils`, `priceFils`).

**Locale.** Public routes live under `/[locale]/...` where `locale ∈ { "ar", "en" }`. Default is `ar`. The root `<html>` `lang` and `dir` are set based on the active locale. The admin panel is **English-only** in v1 — no locale prefix, no translations.

**RTL.** Use **Tailwind logical properties only** in component code:
- ✅ `ms-4`, `me-4`, `ps-2`, `pe-2`, `start-0`, `end-0`, `text-start`, `text-end`
- ❌ `ml-4`, `mr-4`, `pl-2`, `pr-2`, `left-0`, `right-0`, `text-left`, `text-right`

ESLint should be configured to warn on physical properties (Track A task).

**Strings.** All user-visible strings on public routes come from `messages/{locale}.json` via `next-intl`'s `useTranslations()` / `getTranslations()`. **No hardcoded UI text.** Admin strings can be hardcoded English.

**Server Components by default.** Use `"use client"` only when you need state, effects, or browser APIs. Mark client components at the leaf, not the root.

**Mutations.** Use **Server Actions** for all writes from client components. Every Server Action must:
1. Validate input with a Zod schema (shared with the client form).
2. Perform authorization checks if applicable.
3. Return a typed result (`{ ok: true, data } | { ok: false, error }`), never throw across the boundary for expected errors.

**IDs.** `cuid()` for primary keys (Prisma's default). Order numbers are human-readable separately (`SF-2026-00123`).

**File naming.** Components in `PascalCase.tsx`. Hooks in `use-kebab.ts`. Server actions in `kebab.actions.ts`. Repos in `kebab.repo.ts`. Schemas in `kebab.schema.ts`.

**Imports.** Always use the `@/` alias for app-local, `@workspace/ui` for UI, `@workspace/db` for db.

**No barrel files** for app-local modules (they hurt tree-shaking and create circular imports). Use explicit paths.

---

## 4. Data Model (final Prisma schema)

This is the schema Track B will implement. Other tracks should treat this as source of truth.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id            String   @id @default(cuid())
  slug          String   @unique
  nameAr        String
  nameEn        String
  descAr        String?  @db.Text
  descEn        String?  @db.Text
  priceFils     Int
  compareAtFils Int?
  isActive      Boolean  @default(true)
  isFinalSale   Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  variants      ProductVariant[]
  images        ProductImage[]
  @@index([isActive, createdAt])
}

model ProductVariant {
  id          String      @id @default(cuid())
  productId   String
  product     Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  colorNameAr String?
  colorNameEn String?
  colorHex    String?
  size        Size
  stock       Int         @default(0)
  sku         String?     @unique
  orderItems  OrderItem[]
  @@unique([productId, colorHex, size])
  @@index([productId])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  altAr     String?
  altEn     String?
  position  Int     @default(0)
  @@index([productId, position])
}

model Order {
  id            String       @id @default(cuid())
  orderNumber   String       @unique
  status        OrderStatus  @default(PENDING_VERIFICATION)
  customerName  String
  phone         String       // E.164, e.g. +971501234567
  phoneVerified Boolean      @default(false)
  email         String?
  emirate       Emirate
  city          String
  addressLine1  String
  addressLine2  String?
  notes         String?      @db.Text
  subtotalFils  Int
  shippingFils  Int
  totalFils     Int
  locale        String       // "ar" or "en"
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  confirmedAt   DateTime?
  shippedAt     DateTime?
  deliveredAt   DateTime?
  cancelledAt   DateTime?
  cancelReason  String?
  items         OrderItem[]
  events        OrderEvent[]
  @@index([status, createdAt])
  @@index([phone])
}

model OrderItem {
  // snapshot all fields at order time — never read from current Product
  id            String         @id @default(cuid())
  orderId       String
  order         Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId     String
  variant       ProductVariant @relation(fields: [variantId], references: [id])
  productNameAr String
  productNameEn String
  colorNameAr   String?
  colorNameEn   String?
  size          Size
  unitPriceFils Int
  quantity      Int
  @@index([orderId])
}

model OrderEvent {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  type      String   // "status_change" | "note" | "courier_assigned" | "system"
  payload   Json
  actorId   String?  // AdminUser.id, null = system
  createdAt DateTime @default(now())
  @@index([orderId, createdAt])
}

model AdminUser {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  role         AdminRole @default(STAFF)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model OtpAttempt {
  id        String   @id @default(cuid())
  phone     String
  ip        String
  success   Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([phone, createdAt])
  @@index([ip, createdAt])
}

model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}

enum Size { XS S M L XL XXL FREE }

enum Emirate {
  ABU_DHABI
  DUBAI
  SHARJAH
  AJMAN
  UMM_AL_QUWAIN
  RAS_AL_KHAIMAH
  FUJAIRAH
}

enum AdminRole { OWNER STAFF }

enum OrderStatus {
  PENDING_VERIFICATION
  NEW
  CONFIRMED
  SHIPPED
  DELIVERED
  REFUSED
  CANCELLED
}
```

### Initial Settings rows (seeded)

| Key | Value (JSON) | Purpose |
|---|---|---|
| `shipping.flat_fils` | `2500` | 25 AED flat fee |
| `shipping.free_threshold_fils` | `60000` | Free over 600 AED |
| `contact.whatsapp_number` | `"+971501234567"` (placeholder) | Floating button + customer contact |
| `contact.business_hours_ar` | `"السبت – الخميس، 10ص – 10م"` | Footer |
| `contact.business_hours_en` | `"Sat–Thu, 10am – 10pm"` | Footer |
| `size_chart.cm` | See seed file | Size guide modal |
| `order.max_items` | `5` | Anti-abuse |
| `order.max_qty_per_variant` | `2` | Anti-abuse |

---

## 5. Environment Variables

See `.env.example` for the canonical list. Every variable used by code must appear there.

**Server-only** (no `NEXT_PUBLIC_` prefix):
- `DATABASE_URL` — Neon Postgres connection string (pooled)
- `DIRECT_URL` — Neon direct (for migrations)
- `NEXTAUTH_SECRET` — random 32-byte base64
- `NEXTAUTH_URL` — `http://localhost:3000` locally, deployment URL on Vercel
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — e.g. `"S Fashion <orders@sfashion.ae>"`
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

**Client-exposed** (`NEXT_PUBLIC_` prefix):
- `NEXT_PUBLIC_APP_URL` — canonical URL
- `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_TIKTOK_PIXEL_ID`

**Local dev only:** copy `.env.example` to `.env.local`. Never commit `.env.local`.

---

## 6. Settings (DB-backed runtime config)

Anything that the business owner may want to change without a deploy lives in the `Setting` table (see §4). Code reads via `getSetting(key)` repo function (Track B owns). UI for editing is built in Round 2 (admin settings page). For Round 1, values come from seed.

---

## 7. Pre-flight — YOU do these before spawning agents

### 7.1 Provision external services

| Service | What | Output you'll paste |
|---|---|---|
| **Neon Postgres** | In Vercel dashboard → Storage → Create → Neon. Pick free tier, region closest to UAE (Frankfurt is fine). Connect to the `s-fashion` Vercel project. | `DATABASE_URL`, `DIRECT_URL` (Vercel injects automatically; pull with `vercel env pull`) |
| **Twilio Verify** | twilio.com → free trial → Verify → create a service named `s-fashion-otp`. Channel: SMS. | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| **Resend** | resend.com → sign up → API Keys → create. Add and verify a domain later (use `onboarding@resend.dev` for now). | `RESEND_API_KEY`, set `RESEND_FROM_EMAIL="S Fashion <onboarding@resend.dev>"` for now |
| **Vercel Blob** | Vercel dashboard → Storage → Create → Blob. Connect to `s-fashion` project. | `BLOB_READ_WRITE_TOKEN` (auto-injected) |
| **Telegram bot** | In Telegram, talk to **@BotFather** → `/newbot` → name it `s-fashion-orders`. Save the token. Create a group, add the bot, send any message, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id` (negative number for groups). | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| **Meta Pixel** | business.facebook.com → Events Manager → Connect Data Sources → Web → Pixel. Skip if your friend already has one for IG ads. | `NEXT_PUBLIC_META_PIXEL_ID` (15-digit number) |
| **TikTok Pixel** | TikTok Business Center → Assets → Events → Web Events → Create Pixel. | `NEXT_PUBLIC_TIKTOK_PIXEL_ID` |
| **NextAuth secret** | Run locally: `openssl rand -base64 32` | `NEXTAUTH_SECRET` |

### 7.2 Install all dependencies (run once, locally)

```bash
cd /Users/khaled/Documents/code/s-fashion

# Web app deps
pnpm -F web add \
  next-intl \
  zod \
  react-hook-form @hookform/resolvers \
  @tanstack/react-query \
  zustand \
  twilio \
  resend \
  @vercel/blob \
  next-auth@beta @auth/prisma-adapter \
  bcryptjs \
  libphonenumber-js

pnpm -F web add -D @types/bcryptjs

# Create db package (Track B will populate it; this just sets up the workspace folder)
mkdir -p packages/db
cat > packages/db/package.json <<'EOF'
{
  "name": "@workspace/db",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "deploy": "prisma migrate deploy",
    "studio": "prisma studio",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "tsx": "^4.0.0",
    "@workspace/typescript-config": "workspace:*",
    "typescript": "^5"
  }
}
EOF

pnpm install

# Add db to web app's dependencies
pnpm -F web add @workspace/db@workspace:*
```

Commit the lockfile after this. **Now agents can run in parallel without lockfile conflicts.**

### 7.3 Create `.env.local` from `.env.example`

```bash
cp .env.example .env.local
# fill in the values you collected in 7.1
```

### 7.4 Verify

```bash
pnpm install
pnpm typecheck
```

Should pass. If yes, you're ready to spawn 4 agents.

---

## 8. Round 1 — Foundation Tracks (4 parallel)

Each agent gets ONE track. Tracks are designed for **zero file overlap**. After all 4 land, Round 2 (feature tracks) can start.

> **All agents must read SPEC.md before starting** and must respect the conventions in §3.

---

### Track A — Design System, i18n, Layout Shell

**Goal:** Establish the visual language and locale infrastructure. Render an empty home and PDP shell in both Arabic (RTL) and English (LTR) with the header, footer, and floating WhatsApp button.

**Files this track OWNS** (create / modify freely):
- `apps/web/app/layout.tsx`
- `apps/web/app/[locale]/layout.tsx` *(create)*
- `apps/web/app/[locale]/page.tsx` *(stub — title only, real content in Round 2)*
- `apps/web/app/[locale]/products/[slug]/page.tsx` *(stub)*
- `apps/web/middleware.ts` *(i18n routing only)*
- `apps/web/i18n.ts` *(new)*
- `apps/web/messages/ar.json` *(new)*
- `apps/web/messages/en.json` *(new)*
- `apps/web/lib/locale.ts` *(new)*
- `apps/web/lib/money.ts` *(new — see §3)*
- `apps/web/components/layout/header.tsx`
- `apps/web/components/layout/footer.tsx`
- `apps/web/components/layout/whatsapp-float.tsx`
- `apps/web/components/layout/locale-switcher.tsx`
- `apps/web/components/theme-provider.tsx` *(modify — remove dark mode toggle)*
- `packages/ui/src/styles/globals.css` *(replace tokens with brand palette below)*
- `apps/web/next.config.ts` *(add next-intl plugin)*
- ESLint config: add rule warning against `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`
- Any shadcn components needed for layout: `dropdown-menu`, `sheet`, `button` (already exists). Install via `pnpm dlx shadcn@latest add <name> -c apps/web`.

**Files this track MUST NOT touch:**
- `packages/db/**` (Track B)
- `apps/web/app/api/auth/**` (Track D)
- `apps/web/app/admin/**` (Track D)
- `apps/web/lib/auth.ts` (Track D)
- `apps/web/lib/services/**` (Track C)
- `apps/web/lib/repos/**` (Track B)

**External services:** none.

**Brand design tokens** (replace existing tokens in `packages/ui/src/styles/globals.css`):

```css
:root {
  --background: oklch(0.975 0.010 85);
  --foreground: oklch(0.22 0.012 50);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.012 50);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.012 50);
  --primary: oklch(0.55 0.075 55);
  --primary-foreground: oklch(0.98 0.005 85);
  --secondary: oklch(0.95 0.012 80);
  --secondary-foreground: oklch(0.22 0.012 50);
  --muted: oklch(0.94 0.010 80);
  --muted-foreground: oklch(0.5 0.015 55);
  --accent: oklch(0.92 0.015 75);
  --accent-foreground: oklch(0.22 0.012 50);
  --destructive: oklch(0.42 0.13 20);
  --border: oklch(0.90 0.014 75);
  --input: oklch(0.90 0.014 75);
  --ring: oklch(0.55 0.075 55);
  --chart-1: oklch(0.55 0.075 55);
  --chart-2: oklch(0.42 0.13 20);
  --chart-3: oklch(0.65 0.060 75);
  --chart-4: oklch(0.50 0.090 40);
  --chart-5: oklch(0.36 0.10 15);
  --radius: 0.5rem;
  /* sidebar tokens: mirror the main tokens — admin uses these */
  --sidebar: oklch(0.97 0.010 80);
  --sidebar-foreground: oklch(0.22 0.012 50);
  --sidebar-primary: oklch(0.55 0.075 55);
  --sidebar-primary-foreground: oklch(0.98 0.005 85);
  --sidebar-accent: oklch(0.92 0.015 75);
  --sidebar-accent-foreground: oklch(0.22 0.012 50);
  --sidebar-border: oklch(0.90 0.014 75);
  --sidebar-ring: oklch(0.55 0.075 55);
}
```

**Remove the `.dark { ... }` block entirely** — v1 ships light-only.

**Add to `@theme inline`:**
```css
--font-heading: var(--font-heading);
```

**Fonts (in `apps/web/app/layout.tsx`):**
- `Nunito_Sans` (Latin body) — keep existing
- `Cormorant` (Latin display) → `--font-heading`
- `Tajawal` (Arabic body, subset `arabic`) → also bind to `--font-sans` so Arabic uses it
- `Reem_Kufi` (Arabic display, subset `arabic`) → also bind to `--font-heading`

Use `next/font/google`. Set `display: "swap"`. Apply both `--font-sans` and `--font-heading` variables to `<html>`. Tailwind utility `font-sans` already maps; expose `font-heading` via the `@theme inline` block above.

**i18n:**
- Locales: `["ar", "en"]`. Default: `"ar"`.
- Use `next-intl`'s App Router setup: `i18n.ts` request config + `middleware.ts` matcher.
- `apps/web/app/[locale]/layout.tsx`:
  - Validates `locale` param.
  - Sets `<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>` (note: root `layout.tsx` handles the html element; this nested layout sets locale-specific things).
- Translation namespaces: `common`, `header`, `footer`, `home`, `product`, `cart`, `checkout`, `order`. Seed each namespace with the keys obvious from §10 below (placeholder values OK).

**Header:**
- Brand wordmark `S FASHION` in `font-heading`, generous letter-spacing. Links to home.
- Cart icon with item-count badge (reads from Zustand store — Track A creates the store file *only with empty stub*; Track F fills it).
- Locale switcher (Arabic ⇄ English).
- Mobile: condensed; logo center, cart icon end, locale switcher start.
- Desktop: logo start, nav center (just "All" link for now), cart + locale end.

**Footer:**
- Brand mark, short tagline.
- Two link columns: "Shop" (just "All Products") and "Help" (Shipping, Returns, Contact, About).
- Social icons (Instagram, TikTok, Snapchat) — links can be `#` placeholders.
- Business hours from settings (use placeholder strings until Track B's repo lands; just render hardcoded for now and add `// TODO: read from settings` comment with the setting key).
- Bottom strip: copyright + small "Made with care in the UAE" line.

**Floating WhatsApp button:**
- Fixed position, `bottom-4 end-4`, circular, brand-primary background.
- `href={wa.me/<number>}` with prefilled text. Number is a placeholder constant for now (`+971501234567`).
- Hidden on `/admin/*` (use a client check on `usePathname`).
- Visible on all `/[locale]/*` pages.

**Cart store stub** (`apps/web/lib/cart-store.ts`):
- Export a Zustand store with the shape Track F will fill, but only implement `items: []` and `itemCount: 0` selectors. Other tracks/Round 2 will flesh it out. Document the intended interface in a TSDoc comment at the top of the file so Track F can implement against it.

**ESLint rule:**
- Add a custom rule (or use `eslint-plugin-tailwindcss` if it has one) to warn on physical-direction Tailwind classes. If no existing plugin works, add a simple `no-restricted-syntax` rule matching string literals containing `ml-`, `mr-`, etc. Document in the eslint config.

**Definition of done:**
- `pnpm dev` starts. Visiting `/` redirects to `/ar`. `/ar` and `/en` both render.
- Arabic version is RTL: header start/end flipped, text reads right-to-left, logical Tailwind classes flip correctly.
- Header, footer, and WhatsApp button render correctly on mobile (375px) and desktop (1280px).
- Locale switcher swaps between `/ar` and `/en` preserving the rest of the path.
- `pnpm typecheck` passes.
- `pnpm lint` passes (and warns on any physical-direction Tailwind classes you find).
- No 404 on `/[locale]/products/test-slug` (stub renders, just shows the slug).

**Public exports for downstream tracks:**
- `lib/money.ts` exports: `formatAed(fils: number, locale: "ar" | "en"): string`, `filsToAed(fils): number`, `aedToFils(aed): number`.
- `lib/locale.ts` exports: `type Locale = "ar" | "en"`, `LOCALES: readonly Locale[]`, `DEFAULT_LOCALE: Locale`, `isLocale(s: string): s is Locale`.
- `lib/cart-store.ts` exports: `useCartStore` (stub).
- Translation files: namespaced keys ready for Round 2 to extend.

---

### Track B — Database, Prisma, Domain Layer

**Goal:** Stand up the `@workspace/db` package with the schema from §4, run the first migration, expose a Prisma client singleton, seed the database, and write repository functions other tracks will call.

**Files this track OWNS:**
- `packages/db/prisma/schema.prisma` *(create — paste schema from §4 verbatim)*
- `packages/db/prisma/migrations/**`
- `packages/db/prisma/seed.ts` *(create)*
- `packages/db/src/index.ts` *(Prisma client singleton + re-export `@prisma/client` types)*
- `packages/db/tsconfig.json`
- `apps/web/lib/repos/products.repo.ts` *(create)*
- `apps/web/lib/repos/orders.repo.ts` *(create)*
- `apps/web/lib/repos/admin-users.repo.ts` *(create)*
- `apps/web/lib/repos/settings.repo.ts` *(create)*
- `apps/web/lib/repos/otp-attempts.repo.ts` *(create)*
- `apps/web/lib/schemas/product.schema.ts` *(create — Zod schemas for product CRUD)*
- `apps/web/lib/schemas/order.schema.ts` *(create — Zod schemas for order creation)*
- `apps/web/lib/order-number.ts` *(create — `SF-YYYY-NNNNN` generator)*

**Files this track MUST NOT touch:**
- Anything in Track A's owned list
- `apps/web/lib/services/**` (Track C)
- `apps/web/lib/auth.ts` (Track D)
- `apps/web/app/admin/**` (Track D)
- `apps/web/app/api/auth/**` (Track D)

**External services:** Neon Postgres (`DATABASE_URL`, `DIRECT_URL`).

**Tasks:**
1. Populate `packages/db/prisma/schema.prisma` with the schema from §4.
2. Add `directUrl = env("DIRECT_URL")` to the datasource block.
3. Add `output = "../node_modules/.prisma/client"` to generator (keep the client local to the package).
4. Run `pnpm -F @workspace/db generate` and `pnpm -F @workspace/db migrate dev --name init` to create the first migration.
5. Implement `packages/db/src/index.ts`:
   ```ts
   import { PrismaClient } from "@prisma/client";
   const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
   export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["query", "error", "warn"] });
   if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
   export * from "@prisma/client";
   ```
6. Write `packages/db/prisma/seed.ts`:
   - Create 5 demo products with 2-3 variants each, 3 images each (use Unsplash placeholder URLs).
   - Seed the `Setting` rows listed at the end of §4.
   - Make idempotent (use `upsert`).
7. Add `prisma.seed` command to `packages/db/package.json`:
   ```json
   "prisma": { "seed": "tsx prisma/seed.ts" }
   ```
   Then `pnpm -F @workspace/db exec prisma db seed` works.
8. Implement repositories in `apps/web/lib/repos/`:
   - `products.repo.ts`:
     - `listActiveProducts(opts?: { take?: number; skip?: number })`
     - `getProductBySlug(slug: string)` (with variants + images)
     - `getProductById(id: string)`
     - `listAllProductsForAdmin(opts)` (includes inactive)
     - `createProduct(input)`, `updateProduct(id, input)`, `toggleProductActive(id)`
     - `decrementVariantStock(variantId, qty)` (used by order creation; throws if insufficient)
   - `orders.repo.ts`:
     - `createOrder(input, items[])` — wraps in `prisma.$transaction`, snapshots item data, decrements stock, creates `OrderEvent` of type `"status_change"` with `{ to: "PENDING_VERIFICATION" }`, returns `{ id, orderNumber }`
     - `markPhoneVerified(orderId)` — sets `phoneVerified = true`, status → `NEW`, appends event
     - `getOrderById(id)`, `getOrderByNumber(orderNumber)`, `listOrders(filter)`
     - `updateOrderStatus(orderId, newStatus, actorId, reason?)` — appends `OrderEvent`, sets timestamp column matching status, re-credits stock on `CANCELLED`/`REFUSED`
   - `admin-users.repo.ts`:
     - `findAdminByEmail(email)`, `createAdmin(input)`, `verifyPassword(email, plain)`
   - `settings.repo.ts`:
     - `getSetting<T>(key: string): Promise<T | null>` (typed via overloads for known keys)
     - `setSetting(key, value)`
     - `getAllSettings()`
   - `otp-attempts.repo.ts`:
     - `recordAttempt(phone, ip, success)`
     - `countAttemptsForPhone(phone, sinceMinutes)`
     - `countAttemptsForIp(ip, sinceMinutes)`
9. Implement Zod schemas in `apps/web/lib/schemas/`:
   - `product.schema.ts`: `productCreateSchema`, `productUpdateSchema`, `productVariantSchema` (with size enum, color hex regex, stock ≥ 0).
   - `order.schema.ts`: `orderCreateSchema` — name (min 2), phone (E.164 via libphonenumber-js), emirate enum, city (min 1), addressLine1 (min 4), addressLine2 (optional), notes (optional, max 500), email (optional), locale (literal `"ar" | "en"`), items array (≥1 item, each: variantId + quantity 1-2).
10. Implement `order-number.ts`: `generateOrderNumber()` → `SF-{YYYY}-{NNNNN}` where NNNNN is a 5-digit padded count derived from a DB query (count of orders in current year + 1). Must be called inside a transaction.

**Definition of done:**
- `pnpm -F @workspace/db migrate dev` runs cleanly against your local Neon URL.
- `pnpm -F @workspace/db exec prisma db seed` inserts 5 products + settings without errors. Re-running it is idempotent.
- `pnpm -F @workspace/db studio` shows seeded data.
- `pnpm typecheck` passes across the workspace.
- All repo functions are type-safe end to end (input → output).
- Unit-testable shape: each repo function takes plain values and returns plain values; no I/O hidden behind class state.

**Public exports for downstream tracks:**
- `@workspace/db` → `prisma` client, all generated Prisma types (`Order`, `Product`, etc.), all enums.
- `apps/web/lib/repos/*` → repository functions listed above.
- `apps/web/lib/schemas/*` → Zod schemas.
- `apps/web/lib/order-number.ts` → `generateOrderNumber`.

---

### Track C — External Integrations (services + analytics)

**Goal:** Wrap every external service in a typed module with a clean interface. After this track, calling Twilio/Telegram/Resend/Blob from anywhere else is a one-line function call. Wire up Meta + TikTok pixels in the layout (gated on cookie consent).

**Files this track OWNS:**
- `apps/web/lib/services/twilio.ts` *(create)*
- `apps/web/lib/services/telegram.ts` *(create)*
- `apps/web/lib/services/resend.ts` *(create)*
- `apps/web/lib/services/blob.ts` *(create)*
- `apps/web/lib/services/pixels.ts` *(create — type-safe event dispatch helpers)*
- `apps/web/lib/services/rate-limit.ts` *(create — in-process token bucket used by OTP flow; simple Map-based for v1)*
- `apps/web/components/analytics/meta-pixel.tsx` *(client component, loads Meta Pixel script after consent)*
- `apps/web/components/analytics/tiktok-pixel.tsx`
- `apps/web/components/analytics/cookie-banner.tsx`
- `apps/web/components/analytics/analytics-provider.tsx` *(orchestrates consent state and renders the two pixels)*
- Update `apps/web/app/layout.tsx` **only to add `<AnalyticsProvider>`** at the very bottom of `<body>`. Coordinate with Track A by adding this *after* Track A's layout changes are committed — leave a TODO note and a clearly marked diff if you have to merge.

> File-merge coordination on `apps/web/app/layout.tsx`: Track A owns the file. Track C's change is purely additive — render `<AnalyticsProvider />` as a sibling to `{children}` inside `<body>`. If you both touch the file, Track C's change rebases on top of Track A's.

**Files this track MUST NOT touch:**
- `packages/db/**` (Track B)
- `apps/web/lib/auth.ts` (Track D)
- `apps/web/app/admin/**` (Track D)
- Anything Track A owns except for the one additive change to `layout.tsx`.

**External services / env vars used:**
- Twilio (`TWILIO_*`)
- Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- Vercel Blob (`BLOB_READ_WRITE_TOKEN`)
- Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)
- Meta + TikTok pixel IDs (`NEXT_PUBLIC_*`)

**Tasks:**
1. **Twilio Verify wrapper** (`services/twilio.ts`):
   - `sendOtp(phoneE164: string): Promise<{ ok: true } | { ok: false; error: string }>`
   - `checkOtp(phoneE164: string, code: string): Promise<{ ok: boolean; status: "approved" | "pending" | "failed" }>`
   - Reads `TWILIO_VERIFY_SERVICE_SID`. Use `verify.v2.services(SID).verifications.create({ to, channel: "sms" })` and `.verificationChecks.create({ to, code })`.
   - Wrap errors and return typed results — never throw.
2. **Telegram wrapper** (`services/telegram.ts`):
   - `sendOrderNotification(order: { orderNumber, customerName, phone, emirate, totalFils, itemCount, adminUrl })`
   - Sends a formatted HTML message to `TELEGRAM_CHAT_ID` via `https://api.telegram.org/bot<TOKEN>/sendMessage`.
   - Include a clickable "Open in admin" link.
   - Returns `{ ok: boolean }`. Logs but doesn't throw.
3. **Resend wrapper** (`services/resend.ts`):
   - `sendOrderConfirmationEmail({ to, locale, order })` — minimal email, bilingual based on `locale`.
   - HTML inline; no external email template service. Plain elegant.
4. **Vercel Blob wrapper** (`services/blob.ts`):
   - `uploadProductImage(file: File | Blob, filename: string): Promise<{ url: string }>`
   - Uses `@vercel/blob`'s `put()` with `access: "public"`. Path prefix `products/`.
   - `deleteProductImage(url: string)` using `del()`.
5. **Pixels** (`services/pixels.ts`):
   - Type-safe events: `viewContent({ productId, value })`, `addToCart({ productId, value })`, `initiateCheckout({ value })`, `purchase({ orderId, value })`.
   - Each function fires both Meta (`window.fbq`) and TikTok (`window.ttq`) calls.
   - Guards against `typeof window === "undefined"` and missing pixel objects.
6. **Cookie consent + pixel loaders:**
   - `cookie-banner.tsx` shows banner if `localStorage.getItem("cookieConsent")` is null. Two buttons: "Accept" / "Decline". Persists choice. Bilingual via translation keys (coordinate with Track A's `messages/*.json` namespace `cookie`).
   - `meta-pixel.tsx` and `tiktok-pixel.tsx` use `next/script` with `strategy="afterInteractive"`, only rendered when consent === "accept".
   - `analytics-provider.tsx` is a client component that reads consent from localStorage, renders banner if needed, renders pixel components conditionally.
7. **Rate limit** (`services/rate-limit.ts`):
   - Simple in-memory bucket keyed by (phone, ip). Methods: `tryAcquire(key, max, windowMs): boolean`. Persisted in module-level `Map`. For v1 single-instance Vercel functions, this is acceptable; document the limitation (won't survive across cold starts; OK because we also persist `OtpAttempt` rows for hard limits).

**Definition of done:**
- `pnpm typecheck` passes.
- A throwaway script (`scripts/smoke-services.ts`, not committed) confirms:
  - `sendOtp("+971501234567")` returns ok (use your own number).
  - `sendOrderNotification(...)` posts to the Telegram group.
  - `uploadProductImage(...)` returns a URL you can `curl` and get the file back.
  - `sendOrderConfirmationEmail(...)` arrives in your inbox (using your verified Resend domain or `onboarding@resend.dev`).
- Cookie banner appears on first visit to `/`, hides after click, persists choice across reloads. Pixels only fire when consent is accepted (verify in Network tab).

**Public exports for downstream tracks:**
- `lib/services/twilio.ts` → `sendOtp`, `checkOtp`
- `lib/services/telegram.ts` → `sendOrderNotification`
- `lib/services/resend.ts` → `sendOrderConfirmationEmail`
- `lib/services/blob.ts` → `uploadProductImage`, `deleteProductImage`
- `lib/services/pixels.ts` → typed pixel event helpers (client-side only)
- `lib/services/rate-limit.ts` → `tryAcquire`

---

### Track D — Auth + Admin Scaffold

**Goal:** NextAuth v5 configured with Credentials provider, admin layout protected by a server-component auth check, login page that works, and a one-off script to create the first admin user. Admin dashboard page is a placeholder — actual orders/products UI is Round 2.

**Files this track OWNS:**
- `apps/web/lib/auth.ts` *(NextAuth config + `auth()` helper export)*
- `apps/web/app/api/auth/[...nextauth]/route.ts`
- `apps/web/app/admin/layout.tsx` *(server component — runs `auth()`, redirects if no session)*
- `apps/web/app/admin/page.tsx` *(placeholder dashboard)*
- `apps/web/app/admin/login/page.tsx`
- `apps/web/app/admin/login/login-form.tsx` *(client component)*
- `apps/web/app/admin/logout/route.ts` *(POST route to sign out)*
- `apps/web/scripts/create-admin.ts` *(CLI: `pnpm -F web tsx scripts/create-admin.ts`)*
- `apps/web/components/admin/sidebar.tsx` *(placeholder; full version in Round 2)*
- `apps/web/components/admin/topbar.tsx`
- Add shadcn `form`, `input`, `label`, `alert` to `packages/ui` via the add-component command.

**Files this track MUST NOT touch:**
- `apps/web/middleware.ts` (Track A owns it — auth gating happens in the admin layout, NOT middleware; if you need to add middleware-level checks later, coordinate)
- Anything Track A, B, C own (other than the additive shadcn component additions)
- `packages/db/**` schema (use Track B's repo functions only)

**External services:** none directly (uses `AdminUser` table via Track B's repo).

**Tasks:**
1. **NextAuth v5 config** (`lib/auth.ts`):
   - Credentials provider:
     - Calls `findAdminByEmail` + `verifyPassword` from `lib/repos/admin-users.repo.ts`.
     - Returns `{ id, email, name, role }` on success.
   - JWT session strategy.
   - `session.user.role` callback (propagate role from token).
   - `pages.signIn = "/admin/login"`.
   - Use `@auth/prisma-adapter` only if you need OAuth providers later — for Credentials with JWT, the adapter is optional. **Skip the adapter for v1** to keep things simple.
   - Export: `{ handlers, auth, signIn, signOut }` from NextAuth.
2. **API route** (`app/api/auth/[...nextauth]/route.ts`):
   - `export const { GET, POST } = handlers`.
3. **Admin layout** (`app/admin/layout.tsx`):
   - Server component.
   - `const session = await auth();` — redirect to `/admin/login` if `!session` AND current path is not `/admin/login`.
   - Renders sidebar + topbar + `{children}` for authed users.
   - The login page should NOT inherit this layout — it lives at `/admin/login` and uses its own minimal layout. Achieve this by structuring `/admin/login` as a route group or putting the auth check in `/admin/(authed)/layout.tsx` and moving authed pages under that group. Pick whichever is idiomatic for Next.js 16 — consult the docs.
4. **Login page** (`/admin/login`):
   - Server component renders `<LoginForm />`.
   - `LoginForm` (client): form with email + password, validated with `react-hook-form` + Zod (`adminLoginSchema`). On submit, calls `signIn("credentials", { email, password, redirect: false })`. Show error if `result?.error`.
   - On success, `router.push("/admin")`.
5. **Logout route** (`app/admin/logout/route.ts`):
   - POST handler that calls `signOut({ redirect: false })` and returns a redirect to `/admin/login`.
6. **Placeholder dashboard** (`app/admin/page.tsx`):
   - Shows "Welcome, {user.name}", placeholder cards for "Orders today", "Pending orders", "Low stock" with "—" values and a `// TODO: Round 2` comment.
7. **Sidebar + topbar:**
   - Sidebar: links to Dashboard, Orders, Products, Settings (only Dashboard is wired in Round 1; others are `href="#"` with a `data-coming-soon` attribute).
   - Topbar: shows current user's email + a logout button (POSTs to `/admin/logout`).
8. **Create-admin CLI** (`scripts/create-admin.ts`):
   - Reads `EMAIL`, `PASSWORD`, `NAME`, `ROLE` from CLI args or env.
   - Hashes password with bcrypt (12 rounds).
   - Calls `createAdmin` from the repo.
   - Print success or error. Exit code 0/1.
   - Add npm script in `apps/web/package.json`: `"create-admin": "tsx scripts/create-admin.ts"`.
9. **Lockout** (optional Round 1, nice-to-have): after 5 failed logins for the same email, return generic "Too many attempts" error for 15 minutes. Track via `OtpAttempt` table reused with phone=email, or add a small in-memory map. If short on time, skip and document as Round 2 task.

**Definition of done:**
- Navigate to `/admin` → redirected to `/admin/login`.
- Run `pnpm -F web tsx scripts/create-admin.ts --email you@example.com --password secret123 --name "Khaled" --role OWNER`. Confirm DB row created.
- Log in with those creds → land on `/admin` showing "Welcome, Khaled".
- Click logout → returned to `/admin/login`. Re-visiting `/admin` redirects to login.
- `pnpm typecheck` passes.
- Admin layout does NOT load on `/[locale]/...` routes. Public layout does NOT load on `/admin/...` routes.

**Public exports for downstream tracks:**
- `lib/auth.ts` → `{ auth, signIn, signOut, handlers }`
- The fact that `/admin/*` is protected — Round 2 admin pages just live under `/admin/(authed)/` and inherit the gate.

---

## 9. Coordination Notes

- **`apps/web/app/layout.tsx`** is shared by Track A (owner) and touched once by Track C (additive). Track C waits to merge until Track A's commit is in, then rebases.
- **`packages/ui/src/components/`** receives new shadcn components from Tracks A and D independently. The `pnpm dlx shadcn add` command writes one file per component. As long as the tracks don't add the same component, no conflict. If overlap, the later commit wins — both invocations produce the same file content from the same shadcn registry.
- **`pnpm-lock.yaml`** should NOT change during agent runs (all deps installed pre-flight in §7.2). If an agent needs a new dep mid-track, stop and coordinate.
- **Migrations** are owned by Track B only. No other track touches `packages/db/`.

## 10. Translation key skeleton (Track A seeds, others extend)

```json
// messages/ar.json (and matching en.json — English values)
{
  "common": {
    "currency": "د.إ",
    "loading": "...جاري التحميل",
    "save": "حفظ",
    "cancel": "إلغاء",
    "back": "رجوع"
  },
  "header": {
    "shop_all": "كل المنتجات",
    "cart": "السلة",
    "language": "English"
  },
  "footer": {
    "tagline": "أناقة تليق بك",
    "shop_heading": "المتجر",
    "help_heading": "المساعدة",
    "shipping": "الشحن والتوصيل",
    "returns": "الإرجاع والاستبدال",
    "contact": "تواصل معنا",
    "about": "من نحن",
    "rights": "جميع الحقوق محفوظة"
  },
  "home": {
    "title": "S Fashion — مخاور فاخرة بالتوصيل"
  },
  "product": {
    "select_size": "اختاري المقاس",
    "select_color": "اختاري اللون",
    "size_chart": "جدول المقاسات",
    "in_stock": "متوفر",
    "low_stock": "قطعة واحدة فقط متبقية",
    "out_of_stock": "نفذت الكمية",
    "add_to_cart": "أضيفي للسلة",
    "ask_on_whatsapp": "اسألي عن المنتج"
  },
  "cart": { "empty": "السلة فارغة", "subtotal": "المجموع الفرعي", "checkout": "إتمام الطلب" },
  "checkout": {
    "contact_heading": "بيانات التواصل",
    "delivery_heading": "بيانات التوصيل",
    "name": "الاسم الكامل",
    "phone": "رقم الجوال",
    "emirate": "الإمارة",
    "city": "المدينة",
    "address_1": "العنوان",
    "address_2": "تفاصيل إضافية",
    "notes": "ملاحظات",
    "shipping_fee": "رسوم التوصيل",
    "total": "الإجمالي",
    "place_order": "تأكيد الطلب",
    "otp_heading": "تأكيد رقم الجوال",
    "otp_helper": "أدخلي الرمز المكون من 6 أرقام",
    "resend_otp": "إعادة الإرسال"
  },
  "order": {
    "success_heading": "تم استلام طلبك",
    "order_number": "رقم الطلب",
    "expected_delivery": "التوصيل خلال 1-3 أيام عمل"
  },
  "cookie": {
    "message": "نستخدم ملفات تعريف الارتباط لتحسين تجربتك.",
    "accept": "موافقة",
    "decline": "رفض"
  }
}
```

Tracks B/C/D extend as needed.

---

## 11. Round 2 Preview (DO NOT START until Round 1 lands)

After all 4 tracks above are merged, the next 4 parallel tracks are:

- **Track E** — Public catalog: home grid + PDP + gallery + size chart modal.
- **Track F** — Cart drawer + checkout + OTP flow + order creation + confirmation page.
- **Track G** — Admin orders list/detail + product CRUD + image upload + settings page.
- **Track H** — Content pages + SEO + JSON-LD + sitemap + OG images + analytics event wiring on real user actions.

I'll write the detailed spec for Round 2 once Round 1 is done.

---

## 12. Definition of Done — Round 1

- All 4 tracks merged.
- `pnpm install && pnpm typecheck && pnpm lint && pnpm build` succeeds from a clean clone.
- `pnpm dev`:
  - `/` redirects to `/ar`. `/ar` and `/en` render with header, footer, WhatsApp button.
  - Locale switcher works. RTL flips correctly on `/ar`.
  - `/admin` redirects to `/admin/login`. Login with a seeded admin works. Logout works.
- `pnpm -F @workspace/db studio` shows seeded data.
- Cookie banner appears, persists. Pixels load only after consent.
- A smoke test confirms Twilio sends an SMS, Telegram receives a test notification, Blob accepts an upload, Resend sends an email.

When all of the above are true, we ship Round 2.
