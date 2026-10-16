import { z } from 'zod';

// Phone: optional "+", then digits with spaces, dashes or brackets; at most 15 characters, at least 7 digits.
const PHONE = /^\+?[\d\s\-()]+$/;
export const isPhone = (v) => PHONE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 7 && (v.match(/\d/g)?.length ?? 0) <= 15 && (v.indexOf('+') <= 0);

/** Optional phone ('' allowed). */
export const phoneSchema = z
  .string()
  .trim()
  .max(15, 'At most 15 characters')
  .refine((v) => v === '' || isPhone(v), 'Enter a valid phone number');

/** Optional email ('' allowed): name@domain.tld */
export const emailSchema = z
  .string()
  .trim()
  .max(150, 'At most 150 characters')
  .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email, e.g. name@company.com');

/** onInput for phone boxes: drops letters and other characters a phone number can't have. */
export function keepPhoneChars(e) {
  const el = e.target;
  const clean = el.value.replace(/[^\d\s\-()+]/g, '');
  if (clean !== el.value) el.value = clean;
}
