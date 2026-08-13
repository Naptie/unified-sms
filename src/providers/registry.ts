import { REGIONS } from "../data/regions.js";
import { AliyunProvider } from "./aliyun.js";
import type { SmsProvider } from "./types.js";

export type VerificationChannel = "sms" | "telegram";

export interface RegionInfo {
  /** Dial code without the leading "+" (e.g. "86") */
  dialCode: string;
  /** ISO 3166-1 alpha-2 code */
  isoCode: string;
  /** worldwide-regions region id */
  regionId: string;
  /** Display names keyed by locale ("en", "zh", "ja") */
  name: Record<string, string>;
  /** How numbers in this entry are verified */
  method: VerificationChannel;
}

/**
 * The canonical list of supported country/region codes (generated from the
 * worldwide-regions data — see src/data/regions.ts).
 * +86 is served by Aliyun SMS; every other dial code falls back to the
 * Telegram contact-sharing flow.
 */
export const SUPPORTED_REGIONS: RegionInfo[] = REGIONS.map((region) => ({
  ...region,
  method: resolveChannel(region.dialCode),
}));

// Lazily instantiated provider singletons
const instances = new Map<string, SmsProvider>();

/**
 * Returns the SMS provider for the given dial code, or `undefined` if no
 * provider is registered for it. A missing provider while the channel logic
 * (resolveChannel) has classified the dial code as SMS-backed indicates a
 * server misconfiguration — callers must handle `undefined` explicitly
 * (e.g. respond with a clear error) instead of asserting it away.
 * To add a new provider (e.g. Twilio for +1), add a case here and update SUPPORTED_REGIONS.
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

/**
 * Which verification channel serves a given dial code.
 * Only +86 is SMS-backed; everything else goes through the Telegram bot.
 */
export function resolveChannel(dialCode: string): VerificationChannel {
  return dialCode === "86" ? "sms" : "telegram";
}
