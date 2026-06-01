// Prisma-free entrypoint. Re-exports the generated enum *values* from Prisma's
// browser build — which carries no Node runtime and never touches `node:fs` —
// with their precise literal types restored from the full client's
// declarations, plus all generated *types*. Crucially this module does NOT
// instantiate `PrismaClient` (see ./index.ts), so client components and the
// shared zod schemas can use enums (Size, OrderStatus, …) and model types
// without dragging the server-only client (and its `node:fs` dependency) into
// the browser bundle.
// @ts-ignore -- the generated Prisma browser build ships no declaration file
// (and TS won't infer types for JS inside node_modules); its enum values are
// re-cast to the precise types from the full client's declarations below.
import * as browser from "../node_modules/.prisma/client/index-browser.js"

// Type-only view of the full client; `typeof import(...)` is erased at runtime
// so it adds nothing to the bundle. Used to restore the precise enum value
// types that the browser build's JS inference would otherwise widen to string.
type Enums = typeof import("../node_modules/.prisma/client/index.js")

export const Size = browser.Size as unknown as Enums["Size"]
export const Emirate = browser.Emirate as unknown as Enums["Emirate"]
export const AdminRole = browser.AdminRole as unknown as Enums["AdminRole"]
export const OrderStatus = browser.OrderStatus as unknown as Enums["OrderStatus"]
export const CouponType = browser.CouponType as unknown as Enums["CouponType"]

// All generated types (model interfaces, enum-as-type unions, the `Prisma`
// namespace types). Type-only, so nothing is emitted into the bundle.
export type * from "../node_modules/.prisma/client/index.js"
