import { AliyunProvider } from "./aliyun.js";
import type { SmsProvider } from "./types.js";

export interface CountryInfo {
  /** Dial code without the leading "+" (e.g. "86") */
  dialCode: string;
  /** Human-readable country/region name */
  name: string;
  /** ISO 3166-1 alpha-2 code */
  isoCode: string;
}

/**
 * The canonical list of supported country/region codes.
 * Add an entry here (and a corresponding factory case in `getProvider`) to enable a new region.
 */
export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { dialCode: "86", name: "China (Mainland)", isoCode: "CN" },
];

// Lazily instantiated provider singletons
const instances = new Map<string, SmsProvider>();

/**
 * Returns the SMS provider for the given dial code, or `undefined` if unsupported.
 * To add a new provider (e.g. Twilio for +1), add a case here and update SUPPORTED_COUNTRIES.
 */
export function getProvider(dialCode: string): SmsProvider | undefined {
  if (dialCode === "86") {
    if (!instances.has("86")) {
      instances.set("86", new AliyunProvider());
    }
    return instances.get("86");
  }

  // Future: add more dial codes here
  // if (dialCode === '1') { ... }

  return undefined;
}

export function isSupportedCountry(dialCode: string): boolean {
  return SUPPORTED_COUNTRIES.some((c) => c.dialCode === dialCode);
}
