import { config } from "../../config.js";
import type { TelegramBotInfo } from "./types.js";

export class TelegramApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramApiError";
  }
}

/** Thin JSON wrapper around the Telegram Bot API using Bun's built-in fetch. */
export async function callBotApi<T = unknown>(
  method: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new TelegramApiError(
      `Telegram API ${method} returned a non-JSON response (HTTP ${response.status})`,
    );
  }

  const body = json as { ok?: boolean; description?: string; result?: T };
  if (!body.ok) {
    throw new TelegramApiError(
      `Telegram API ${method} failed: ${body.description ?? `HTTP ${response.status}`}`,
    );
  }
  return body.result as T;
}

export function getMe(): Promise<TelegramBotInfo> {
  return callBotApi<TelegramBotInfo>("getMe");
}

export function setWebhook(
  url: string,
  secretToken: string,
  maxConnections: number,
): Promise<true> {
  return callBotApi<true>("setWebhook", {
    url,
    secret_token: secretToken,
    max_connections: maxConnections,
    allowed_updates: ["message"],
  });
}

export function deleteWebhook(): Promise<true> {
  return callBotApi<true>("deleteWebhook", { drop_pending_updates: true });
}

export function sendMessage(chatId: number, text: string, replyMarkup?: unknown): Promise<unknown> {
  return callBotApi("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup !== undefined && { reply_markup: replyMarkup }),
  });
}
