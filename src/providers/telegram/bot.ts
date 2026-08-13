import { config } from "../../config.js";
import { deleteWebhook, sendMessage, setWebhook } from "./client.js";
import { toExpectedInternational, toSharedInternational } from "./phone.js";
import { sessionStore } from "./sessions.js";
import type { TelegramMessage, TelegramUpdate } from "./types.js";
import { resolveBotUsername } from "./verification.js";

const CONTACT_KEYBOARD = {
  keyboard: [[{ text: "Share Phone Number", request_contact: true }]],
  one_time_keyboard: true,
  resize_keyboard: true,
};

const START_COMMAND_PREFIX = "/start";

async function handleStart(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const payload = (message.text ?? "").slice(START_COMMAND_PREFIX.length).trim();

  if (!payload) {
    await sendMessage(
      chatId,
      "Start the verification on the website to get your personal verification link.",
    );
    return;
  }

  const session = sessionStore.get(payload);
  if (!session) {
    await sendMessage(
      chatId,
      "This verification link is invalid. Please return to the website and start again.",
    );
    return;
  }
  if (session.status !== "pending") {
    const text =
      session.status === "verified"
        ? "This link has already been verified. You can return to the app."
        : "This verification link has expired. Please return to the website and start again.";
    await sendMessage(chatId, text);
    return;
  }
  if (!sessionStore.bindChat(session.id, chatId)) {
    await sendMessage(
      chatId,
      "This verification link was already claimed by another Telegram account. Please return to the website and start again.",
    );
    return;
  }

  await sendMessage(
    chatId,
    "Please click the 'Share Phone Number' button below to verify your account.",
    CONTACT_KEYBOARD,
  );
}

async function handleContact(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const contact = message.contact;
  if (!contact) return;

  const session = sessionStore.getPendingByChatId(chatId);
  if (!session) {
    await sendMessage(
      chatId,
      "No active verification found. Return to the website and tap the verification link to start.",
    );
    return;
  }

  // Genuineness check: the shared contact must be the sender's own Telegram
  // account (contact.user_id === message.from.id), so nobody can verify a
  // session by forwarding someone else's number from their address book.
  const senderId = message.from?.id;
  if (contact.user_id === undefined || senderId === undefined || contact.user_id !== senderId) {
    await sendMessage(
      chatId,
      "You must share your own phone number using the 'Share Phone Number' button.",
    );
    return;
  }

  const shared = toSharedInternational(contact.phone_number);
  const expected = toExpectedInternational(session.dialCode, session.phoneNumber);
  if (shared !== expected) {
    await sendMessage(
      chatId,
      `The number you shared (+${shared}) does not match the number you entered on the website. ` +
        "Please return to the website and start over with the number registered on this Telegram account.",
    );
    return;
  }

  if (!sessionStore.markVerified(session.id, `+${expected}`)) {
    await sendMessage(
      chatId,
      "This verification session is no longer valid. Please return to the website and start again.",
    );
    return;
  }

  await sendMessage(chatId, "Verified! You can now return to the app.", { remove_keyboard: true });
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
      await sendMessage(
        message.chat.id,
        "Return to the app and tap the verification link to start.",
      );
    }
  } catch (err) {
    console.error("[telegram] failed to handle update:", err);
  }
}
