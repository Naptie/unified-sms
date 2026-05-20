import { treaty } from "@elysia/eden";

import type { App } from "../../src/index.js";

export type { App };

/**
 * Creates a fully typed Eden Treaty client for unified-sms.
 *
 * @param baseUrl - Base URL of the running server, e.g. `"http://127.0.0.1:3000"`
 * @param config  - Optional treaty config (custom `fetch`, default headers, etc.)
 *
 * @example
 * ```ts
 * import { createClient } from "unified-sms-client";
 *
 * const sms = createClient("http://127.0.0.1:3000", {
 *   headers: { authorization: "Bearer my-secret" },
 * });
 *
 * const { data, error } = await sms.sms.send.post({
 *   phoneNumber: "13800138000",
 *   countryCode: "86",
 * });
 * ```
 */
export const createClient = (baseUrl: string, config?: Parameters<typeof treaty>[1]) =>
  treaty<App>(baseUrl, config);

export type Client = ReturnType<typeof createClient>;
