import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Emirate } from "@workspace/db";

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
  emirate: z.nativeEnum(Emirate),
  city: z.string().trim().min(1).max(80),
  addressLine1: z.string().trim().min(4).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  locale: z.union([z.literal("ar"), z.literal("en")]),
  items: z.array(orderItemInputSchema).min(1),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
