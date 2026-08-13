import { config } from "../../config.js";
import { getMe } from "./client.js";
import { sessionStore } from "./sessions.js";
import type { SessionStatus } from "./types.js";

let cachedBotUsername: string | null = null;

/** Resolves and caches the bot username (needed to build t.me deep links). */
export async function resolveBotUsername(): Promise<string> {
  if (cachedBotUsername) return cachedBotUsername;
  const me = await getMe();
  if (!me.username) {
    throw new Error("Telegram bot has no username; set one with BotFather's /setname");
  }
  cachedBotUsername = me.username;
  return cachedBotUsername;
}

/** The Telegram fallback is active only when all three config values are present. */
export function isTelegramEnabled(): boolean {
  return Boolean(
    config.telegram.botToken && config.telegram.webhookUrl && config.telegram.webhookSecret,
  );
}

export interface VerificationHandoff {
  sessionId: string;
  deepLink: string;
  expiresAt: string;
  ttl: number;
}

/** Creates a pending session and returns the handoff payload for the consumer app. */
export async function createVerificationSession(
  phoneNumber: string,
  dialCode: string,
): Promise<VerificationHandoff> {
  const session = sessionStore.create(phoneNumber, dialCode, config.telegram.sessionTtlSeconds);
  const username = await resolveBotUsername();
  return {
    sessionId: session.id,
    deepLink: `https://t.me/${username}?start=${session.id}`,
    expiresAt: new Date(session.expiresAt).toISOString(),
    ttl: config.telegram.sessionTtlSeconds,
  };
}

export interface SessionStatusResult {
  status: SessionStatus;
  verifiedNumber?: string;
}

export function getSessionStatus(sessionId: string): SessionStatusResult | undefined {
  const session = sessionStore.get(sessionId);
  if (!session) return undefined;
  return { status: session.status, verifiedNumber: session.verifiedNumber };
}
