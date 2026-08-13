import type { Locale } from "../../i18n/index.js";

/** Subset of the Telegram Bot API Update model used by the verification flow. */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  contact?: TelegramContact;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  username?: string;
}

export interface TelegramContact {
  phone_number: string;
  first_name?: string;
  last_name?: string;
  /** Set when the shared contact is a Telegram user — for our flow this must be the sender. */
  user_id?: number;
}

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export type SessionStatus = "pending" | "verified" | "expired";

export interface VerificationSession {
  id: string;
  /** Local phone number (no dial code) as entered by the user */
  phoneNumber: string;
  /** Dial code without the leading "+" */
  dialCode: string;
  /** UI language for the bot conversation and API error messages */
  locale: Locale;
  status: SessionStatus;
  createdAt: number;
  expiresAt: number;
  /** Telegram chat that claimed this session via /start */
  chatId?: number;
  /** E.164 number confirmed by the bot, set on successful verification */
  verifiedNumber?: string;
  verifiedAt?: number;
}
