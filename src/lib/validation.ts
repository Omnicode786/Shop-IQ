import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const emptyToNull = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

export const requiredText = (label: string, max = 160) =>
  z.preprocess(emptyToUndefined, z.string({ required_error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max));

export const optionalText = (max = 500) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const nullableText = (max = 500) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

export const optionalEmail = z.preprocess(emptyToUndefined, z.string().trim().email().max(180).toLowerCase().optional());

export const nullableEmail = z.preprocess(emptyToNull, z.string().trim().email().max(180).toLowerCase().nullable().optional());

export const optionalId = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

export const nullableId = z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional());

export const money = z.coerce.number().finite().min(0).default(0);

export const positiveMoney = z.coerce.number().finite().positive();

export const intQty = z.coerce.number().int().min(0).default(0);

export const positiveIntQty = z.coerce.number().int().positive();

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
