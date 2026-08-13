import { randomUUID } from "node:crypto";

import type { Locale } from "../../i18n/index.js";
import type { VerificationSession } from "./types.js";

const MAX_SESSIONS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;
/** How long a verified session stays queryable after verification (grace for polling clients). */
const VERIFIED_GRACE_MS = 5 * 60_000;

/**
 * In-memory store for Telegram verification sessions.
 * Single-process by design — matches the hub's private-server deployment model.
 */
class SessionStore {
  private readonly sessions = new Map<string, VerificationSession>();
  private readonly byChatId = new Map<number, string>();

  create(
    phoneNumber: string,
    dialCode: string,
    ttlSeconds: number,
    locale: Locale,
  ): VerificationSession {
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
    if (this.sessions.size >= MAX_SESSIONS) this.evictOldest();
    this.sessions.set(session.id, session);
    return session;
  }

  /** Returns the session, flipping it to "expired" lazily if its TTL has passed. */
  get(id: string): VerificationSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (session.status === "pending" && session.expiresAt <= Date.now()) {
      session.status = "expired";
      if (session.chatId !== undefined) this.byChatId.delete(session.chatId);
    }
    return session;
  }

  /** Returns the pending session claimed by the given chat, if any. */
  getPendingByChatId(chatId: number): VerificationSession | undefined {
    const id = this.byChatId.get(chatId);
    if (!id) return undefined;
    const session = this.get(id);
    if (!session || session.status !== "pending") return undefined;
    return session;
  }

  /**
   * Binds a session to a Telegram chat. Returns false if the session was
   * already claimed by a different chat.
   */
  bindChat(id: string, chatId: number): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    if (session.chatId !== undefined && session.chatId !== chatId) return false;
    if (session.chatId === chatId) return true;
    session.chatId = chatId;
    this.byChatId.set(chatId, id);
    return true;
  }

  /** Marks a pending session verified. Fails on missing, expired, or already-closed sessions. */
  markVerified(id: string, verifiedNumber: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    if (session.status !== "pending" || session.expiresAt <= Date.now()) return false;
    session.status = "verified";
    session.verifiedNumber = verifiedNumber;
    session.verifiedAt = Date.now();
    return true;
  }

  /** Drops expired sessions and verified sessions past their polling grace period. */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      const pastGrace =
        session.status === "verified" &&
        session.verifiedAt !== undefined &&
        now - session.verifiedAt > VERIFIED_GRACE_MS;
      if (session.expiresAt <= now || pastGrace) {
        this.sessions.delete(id);
        if (session.chatId !== undefined) this.byChatId.delete(session.chatId);
        removed++;
      }
    }
    return removed;
  }

  private evictOldest(): void {
    const oldest = this.sessions.entries().next();
    if (oldest.done) return;
    const [id, session] = oldest.value;
    this.sessions.delete(id);
    if (session.chatId !== undefined) this.byChatId.delete(session.chatId);
  }
}

export const sessionStore = new SessionStore();

export function startSessionCleanup(): void {
  setInterval(() => sessionStore.prune(), CLEANUP_INTERVAL_MS);
}
