import i18next from "i18next";

import { LOCALES, RESOURCES, type Locale } from "./locales.js";

await i18next.init({
  resources: RESOURCES,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export type { Locale };

export { LOCALES } from "./locales.js";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Coerces an arbitrary string to a supported locale, falling back to English. */
export function resolveLocale(value: string | undefined): Locale {
  return value !== undefined && isLocale(value) ? value : "en";
}

/**
 * Picks the best supported locale from an `Accept-Language` header value,
 * honoring q-values and stripping region subtags ("zh-CN" → "zh").
 * Returns undefined when the header is absent or matches nothing.
 */
export function localeFromAcceptLanguage(header: string | undefined): Locale | undefined {
  if (!header) return undefined;
  const weighted: Array<{ locale: Locale; q: number }> = [];
  for (const part of header.split(",")) {
    const [tag, ...attributes] = part.trim().toLowerCase().split(";");
    const base = tag.split("-")[0] ?? tag;
    if (!isLocale(base)) continue;
    const q = attributes
      .find((attribute) => attribute.trim().startsWith("q="))
      ?.trim()
      .slice(2);
    weighted.push({ locale: base, q: q === undefined ? 1 : Number(q) || 0 });
  }
  weighted.sort((a, b) => b.q - a.q);
  return weighted[0]?.locale;
}

export type TFunction = (key: string, params?: Record<string, unknown>) => string;

/** Returns a translate function bound to the given locale. */
export function getT(locale: Locale): TFunction {
  return (key, params) => i18next.t(key, { lng: locale, ...params });
}
