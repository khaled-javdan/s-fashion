import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Emirate } from "@workspace/db";

import { COUNTRY_CODES } from "@/lib/geo";

/** Strict E.164 phone — validates against libphonenumber-js and returns the canonical form. */
const phoneE164 = z.string().transform((raw, ctx) => {
  const parsed = parsePhoneNumberFromString(raw.trim());
  if (!parsed || !parsed.isValid()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid phone number",
    });
    return z.NEVER;
  }
  return parsed.number; // canonical E.164, e.g. +971501234567
});

/** Single line item in a new order. */
export const orderItemInputSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(2),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

/** Full order creation payload — used by both client form + server action. */
export const orderCreateSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  phone: phoneE164,
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // ISO 3166-1 alpha-2 destination country (validated against the supported set).
  country: z.enum(COUNTRY_CODES),
  // UAE-only sub-region. Required when country === "AE"; the rule is enforced in
  // the checkout action + client resolver (kept optional here so the schema stays
  // a plain ZodObject that callers can `.omit`/`.extend`).
  emirate: z.nativeEnum(Emirate).optional(),
  city: z.string().trim().min(1).max(80),
  addressLine1: z.string().trim().min(4).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  locale: z.union([z.literal("ar"), z.literal("en")]),
  /** Marketing opt-in (WhatsApp offers / new arrivals). Defaults to no consent. */
  marketingConsent: z.boolean().optional().default(false),
  items: z.array(orderItemInputSchema).min(1),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
