import { timingSafeEqual } from "node:crypto";
import { Elysia, t } from "elysia";

import { config } from "../config.js";
import { handleUpdate } from "../providers/telegram/bot.js";
import type { TelegramUpdate } from "../providers/telegram/types.js";
import { isTelegramEnabled } from "../providers/telegram/verification.js";

const ErrorResponse = t.Object({
  success: t.Literal(false),
  error: t.String(),
});

function secretMatches(provided: string): boolean {
  const expected = config.telegram.webhookSecret;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Endpoint called by Telegram whenever the bot receives a message.
 * Intentionally exempt from `authPlugin` (Telegram cannot send our Bearer
 * secret); it is protected by Telegram's webhook secret token instead.
 */
export const telegramRoutes = new Elysia({ prefix: "/telegram" }).post(
  "/webhook",
  async ({ body, headers, set }) => {
    if (!isTelegramEnabled()) {
      set.status = 404;
      return { success: false as const, error: "Not found" };
    }

    const secret = headers["x-telegram-bot-api-secret-token"] ?? "";
    if (!secretMatches(secret)) {
      set.status = 403;
      return { success: false as const, error: "Forbidden" };
    }

    await handleUpdate(body as TelegramUpdate);
    return { success: true as const };
  },
  {
    response: {
      200: t.Object({ success: t.Literal(true) }),
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: {
      summary: "Telegram webhook",
      description:
        "Receives updates from the Telegram Bot API. " +
        "Authenticated by the secret token Telegram sends in the X-Telegram-Bot-Api-Secret-Token header; " +
        "this is the only endpoint that does not require the Bearer API secret.",
      tags: ["Telegram"],
    },
  },
);
