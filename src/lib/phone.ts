import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function toE164(input: string, defaultCountry: CountryCode = "US"): string | null {
  if (!input) return null;
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164, e.g. "+14155551234"
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPhone(e164: string): Promise<string> {
  return sha256Hex(e164.trim().toLowerCase());
}

// Common country codes for the picker
export const COUNTRY_CODES: { code: CountryCode; dial: string; label: string }[] = [
  { code: "US", dial: "+1", label: "US/CA" },
  { code: "GB", dial: "+44", label: "UK" },
  { code: "AU", dial: "+61", label: "AU" },
  { code: "DE", dial: "+49", label: "DE" },
  { code: "FR", dial: "+33", label: "FR" },
  { code: "ES", dial: "+34", label: "ES" },
  { code: "IT", dial: "+39", label: "IT" },
  { code: "NL", dial: "+31", label: "NL" },
  { code: "SE", dial: "+46", label: "SE" },
  { code: "NO", dial: "+47", label: "NO" },
  { code: "BR", dial: "+55", label: "BR" },
  { code: "MX", dial: "+52", label: "MX" },
  { code: "IN", dial: "+91", label: "IN" },
  { code: "JP", dial: "+81", label: "JP" },
  { code: "KR", dial: "+82", label: "KR" },
];
