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

/** Build a safe tel: href from a display phone value. Preserves leading +, strips other non-digits. */
export function toTelHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:${hasPlus ? "+" : ""}${digits}`;
}

/** Lightweight validation: at least 6 digits, plus optional +, spaces, parens, dashes, dots, "ext"/"x" for extensions. */
export function isLikelyPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^[+0-9 ()\-.\u00a0]*(?:\s*(?:ext\.?|x)\s*\d+)?$/i.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 20;
}

/** Digits-only signature for search matching. */
export function phoneDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Copy to clipboard with a safe fallback for insecure contexts. */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

