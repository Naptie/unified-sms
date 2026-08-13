import { randomUUID } from "node:crypto";

import { RedisClient } from "bun";

import { config } from "../../config.js";
import type { Locale } from "../../i18n/index.js";
import type { VerificationSession } from "./types.js";

/** How long a verified session stays queryable after verification (grace for polling clients). */
const VERIFIED_GRACE_MS = 5 * 60_000;

const SESSION_KEY_PREFIX = "telegram:session:";
const CHAT_KEY_PREFIX = "telegram:chat:";
const CLAIM_KEY_PREFIX = "telegram:claim:";

let redis: RedisClient;

export async function startSessionStore(): Promise<void> {
  redis = new RedisClient(config.redisUri);
  await redis.ping();
  console.log(`[telegram] session store connected to ${maskRedisUri(config.redisUri)}`);
}

export function shutdownSessionStore(): void {
  redis?.close();
}

function maskRedisUri(uri: string): string {
  try {
    const url = new URL(uri);
    return url.host ? `${url.protocol}//${url.host}` : uri;
  } catch {
    return "(redis)";
  }
}

/**
 * Redis-backed store for Telegram verification sessions.
 * Sessions live in Redis so the store survives restarts and multi-instance deploys;
 * TTLs are capped at the session TTL plus the verified-session grace period.
 */
function sessionKey(id: string): string {
  return `${SESSION_KEY_PREFIX}${id}`;
}

function chatKey(chatId: number): string {
  return `${CHAT_KEY_PREFIX}${chatId}`;
}

function claimKey(id: string): string {
  return `${CLAIM_KEY_PREFIX}${id}`;
}

function hardTtlSeconds(ttlSeconds: number): number {
  return Math.ceil(ttlSeconds + VERIFIED_GRACE_MS / 1000);
}

class SessionStore {
  async create(
    phoneNumber: string,
    dialCode: string,
    ttlSeconds: number,
    locale: Locale,
  ): Promise<VerificationSession> {
    const now = Date.now();
    const session: VerificationSession = {
      id: randomUUID().replace(/-/g, ""),
      phoneNumber,
      dialCode,
      locale,
      status: "pending",
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
    };
    await redis.set(
      sessionKey(session.id),
      JSON.stringify(session),
      "EX",
      hardTtlSeconds(ttlSeconds),
    );
    return session;
  }

  /** Returns the session, flipping it to "expired" lazily if its TTL has passed. */
  async get(id: string): Promise<VerificationSession | undefined> {
    const raw = await redis.get(sessionKey(id));
    if (!raw) return undefined;
    const session = JSON.parse(raw) as VerificationSession;
    if (session.status === "pending" && session.expiresAt <= Date.now()) {
      session.status = "expired";
      if (session.chatId !== undefined) await redis.del(chatKey(session.chatId));
      await redis.set(sessionKey(id), JSON.stringify(session), "KEEPTTL");
    }
    return session;
  }

  /** Returns the pending session claimed by the given chat, if any. */
  async getPendingByChatId(chatId: number): Promise<VerificationSession | undefined> {
    const id = await redis.get(chatKey(chatId));
    if (!id) return undefined;
    const session = await this.get(id);
    if (!session || session.status !== "pending") return undefined;
    return session;
  }

  /**
   * Binds a session to a Telegram chat. Returns false if the session was
   * already claimed by a different chat. The claim is recorded atomically
   * with SET NX so concurrent /start handlers cannot double-bind a session.
   */
  async bindChat(id: string, chatId: number): Promise<boolean> {
    const session = await this.get(id);
    if (!session) return false;
    if (session.chatId !== undefined && session.chatId !== chatId) return false;
    if (session.chatId === chatId) return true;
    if (session.status !== "pending") return false;

    const claimed = await redis.set(
      claimKey(id),
      String(chatId),
      "NX",
      "EX",
      String(hardTtlSeconds(config.telegram.sessionTtlSeconds)),
    );
    if (claimed === null) return false;

    session.chatId = chatId;
    await redis.set(sessionKey(id), JSON.stringify(session), "KEEPTTL");
    await redis.set(
      chatKey(chatId),
      id,
      "EX",
      String(hardTtlSeconds(config.telegram.sessionTtlSeconds)),
    );
    return true;
  }

  /** Marks a pending session verified. Fails on missing, expired, or already-closed sessions. */
  async markVerified(id: string, verifiedNumber: string): Promise<boolean> {
    const session = await this.get(id);
    if (!session) return false;
    if (session.status !== "pending") return false;
    session.status = "verified";
    session.verifiedNumber = verifiedNumber;
    session.verifiedAt = Date.now();
    await redis.set(sessionKey(id), JSON.stringify(session), "KEEPTTL");
    return true;
  }
}

export const sessionStore = new SessionStore();
