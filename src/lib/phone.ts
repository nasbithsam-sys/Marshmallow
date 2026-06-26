/** Format a phone string to US format: (XXX) XXX-XXXX */
export function formatUSPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Strip formatting to get raw digits */
export function stripPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalize a phone number to E.164 when the country code can be inferred safely. */
export function normalizePhoneE164(value: string, defaultCountryCode = "1"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = stripPhone(trimmed);
  if (!digits) return null;

  if (trimmed.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }

  return null;
}
