import { config } from "../../config.js";
import { getT, isLocale, type Locale } from "../../i18n/index.js";
import { deleteWebhook, sendMessage, setWebhook } from "./client.js";
import { toExpectedInternational, toSharedInternational } from "./phone.js";
import { sessionStore } from "./sessions.js";
import type { TelegramMessage, TelegramUpdate } from "./types.js";
import { resolveBotUsername } from "./verification.js";

function contactKeyboard(locale: Locale) {
  const t = getT(locale);
  return {
    keyboard: [[{ text: t("bot.keyboard.share"), request_contact: true }]],
    one_time_keyboard: true,
    resize_keyboard: true,
  };
}

const START_COMMAND_PREFIX = "/start";
/**
 * Separator between the locale and the session id in the deep link start payload.
 * Must be one of A-Z a-z 0-9 "_" "-": Telegram rejects any other character and
 * silently drops the whole payload (the bot then sees a plain /start).
 */
const PAYLOAD_SEPARATOR = "_";

interface StartPayload {
  locale: Locale;
  sessionId: string;
}

/**
 * Parses a /start payload. Current format: `<locale>_<sessionId>` (e.g. `zh_sess_…`).
 * Falls back to treating the whole payload as a bare session id for legacy links.
 */
function parseStartPayload(payload: string): StartPayload {
  const separator = payload.indexOf(PAYLOAD_SEPARATOR);
  if (separator !== -1) {
    const maybeLocale = payload.slice(0, separator);
    if (isLocale(maybeLocale)) {
      return { locale: maybeLocale, sessionId: payload.slice(separator + 1) };
    }
  }
  return { locale: "en", sessionId: payload };
}

async function handleStart(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const { locale, sessionId } = parseStartPayload(
    (message.text ?? "").slice(START_COMMAND_PREFIX.length).trim(),
  );
  const t = getT(locale);

  if (!sessionId) {
    await sendMessage(chatId, t("bot.start.noPayload"));
    return;
  }

  const session = await sessionStore.get(sessionId);
  if (!session) {
    await sendMessage(chatId, t("bot.start.invalid"));
    return;
  }
  if (session.status !== "pending") {
    const text = session.status === "verified" ? t("bot.start.verified") : t("bot.start.expired");
    await sendMessage(chatId, text);
    return;
  }
  if (!(await sessionStore.bindChat(session.id, chatId))) {
    await sendMessage(chatId, t("bot.start.claimed"));
    return;
  }

  await sendMessage(chatId, t("bot.start.prompt"), contactKeyboard(session.locale));
}

async function handleContact(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const contact = message.contact;
  if (!contact) return;

  const session = await sessionStore.getPendingByChatId(chatId);
  const t = getT(session?.locale ?? "en");
  if (!session) {
    await sendMessage(chatId, t("bot.contact.noSession"));
    return;
  }

  // Genuineness check: the shared contact must be the sender's own Telegram
  // account (contact.user_id === message.from.id), so nobody can verify a
  // session by forwarding someone else's number from their address book.
  const senderId = message.from?.id;
  if (contact.user_id === undefined || senderId === undefined || contact.user_id !== senderId) {
    await sendMessage(chatId, t("bot.contact.notOwn"));
    return;
  }

  const shared = toSharedInternational(contact.phone_number);
  const expected = toExpectedInternational(session.dialCode, session.phoneNumber);
  if (shared !== expected) {
    await sendMessage(chatId, t("bot.contact.numberMismatch", { shared }));
    return;
  }

  if (!(await sessionStore.markVerified(session.id, `+${expected}`))) {
    await sendMessage(chatId, t("bot.contact.sessionInvalid"));
    return;
  }

  await sendMessage(chatId, t("bot.contact.verified"), { remove_keyboard: true });
}

/** Registers the webhook with Telegram and warms the cached bot username. */
export async function setupTelegramBot(): Promise<void> {
  await resolveBotUsername();
  await setWebhook(
    config.telegram.webhookUrl,
    config.telegram.webhookSecret,
    config.telegram.maxConnections,
  );
  console.log(
    `[telegram] webhook registered at ${config.telegram.webhookUrl} (max connections: ${config.telegram.maxConnections})`,
  );
}

export async function shutdownTelegramBot(): Promise<void> {
  try {
    await deleteWebhook();
    console.log("[telegram] webhook removed");
  } catch (err) {
    console.error("[telegram] failed to remove webhook:", err);
  }
}

/** Entry point for updates pushed by Telegram via the webhook. */
export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;
  try {
    if (message.contact) {
      await handleContact(message);
    } else if ((message.text ?? "").startsWith(START_COMMAND_PREFIX)) {
      await handleStart(message);
    } else {
      await sendMessage(message.chat.id, getT("en")("bot.other.returnToApp"));
    }
  } catch (err) {
    console.error("[telegram] failed to handle update:", err);
  }
}
