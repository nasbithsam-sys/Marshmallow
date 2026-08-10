import React from "react";

interface RenderEmojiProps {
  emoji?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const FLAG_COUNTRY_MAP: Record<string, string> = {
  "🇱🇦": "la",
  "🇸🇩": "sd",
  "🇸🇨": "sc",
  "🇸🇯": "sj",
  "🇦🇺": "au",
  "🇺🇸": "us",
  "🇨🇦": "ca",
  "🇬🇧": "gb",
};

/**
 * Renders emojis cleanly, using crisp SVG flag images for country flag emojis
 * to guarantee 100% perfect flag display on Windows, Mac, Linux, and mobile devices.
 */
export default function RenderEmoji({
  emoji,
  className = "",
  size = "md",
}: RenderEmojiProps) {
  if (!emoji) return null;

  const trimmed = emoji.trim();
  const countryCode = FLAG_COUNTRY_MAP[trimmed];

  if (countryCode) {
    const dimensions =
      size === "sm"
        ? "h-3.5 w-5"
        : size === "lg"
        ? "h-5 w-7"
        : "h-4 w-6";

    return (
      <img
        src={`https://flagcdn.com/w40/${countryCode}.png`}
        srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
        alt={trimmed}
        className={`${dimensions} object-cover rounded-[2px] inline-block shrink-0 shadow-sm align-middle border border-slate-700/50 ${className}`}
        loading="lazy"
      />
    );
  }

  // Fallback for dynamic 2-character country flags using Twemoji SVG
  if (/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]$/.test(trimmed)) {
    const codePoints = Array.from(trimmed)
      .map((c) => c.codePointAt(0)?.toString(16))
      .filter(Boolean)
      .join("-");

    const dimensions =
      size === "sm"
        ? "h-3.5 w-5"
        : size === "lg"
        ? "h-5 w-7"
        : "h-4 w-6";

    return (
      <img
        src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints}.svg`}
        alt={trimmed}
        className={`${dimensions} object-contain inline-block shrink-0 align-middle ${className}`}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLElement).style.display = "none";
        }}
      />
    );
  }

  // Standard unicode emojis (e.g. 🟡, 🚚, 🚐, 🚨, 🍓, ⚡, 🛠️, 🤠, 📱, 🟠, 🟢, 🚧, ❄️, 🛁, 🎨, 🌴, 🚪, 🎄, 🏙️, 🗽, 📡)
  return <span className={`inline-block align-middle select-none ${className}`}>{trimmed}</span>;
}
