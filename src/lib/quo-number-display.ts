import { getQuoNumberName, getQuoNumberEmoji } from "@/lib/quo-dashboard";

export interface QuoNumberDisplayEntry {
  label?: string;
  emoji?: string;
}

export type QuoNumberDisplayMap = Record<string, QuoNumberDisplayEntry>;

export const QUO_NUMBER_DISPLAY_SETTING_KEY = "quo_number_display";

interface NumberLike {
  id?: string | null;
  name?: string | null;
  label?: string | null;
  number?: string | null;
  display_number?: string | null;
}

/**
 * Resolves the display name of a QUO number, honoring admin-defined
 * custom labels and emojis stored in quo_ai_settings and default maps.
 */
export function resolveQuoNumberDisplay(
  numObj: NumberLike | null | undefined,
  displayMap: QuoNumberDisplayMap,
  fallbackRawNumber?: string | null
): { name: string; emoji: string; full: string } {
  const entry = (numObj?.id && displayMap[numObj.id]) || {};
  const base = (entry.label || "").trim() || getQuoNumberName(numObj, fallbackRawNumber);
  const emoji = (entry.emoji || "").trim() || getQuoNumberEmoji(numObj, fallbackRawNumber);
  return { name: base, emoji, full: emoji ? `${emoji} ${base}` : base };
}
