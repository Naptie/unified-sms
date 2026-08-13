import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

import { config } from "./config.js";
import { setupTelegramBot, shutdownTelegramBot } from "./providers/telegram/bot.js";
import { startSessionCleanup } from "./providers/telegram/sessions.js";
import { isTelegramEnabled } from "./providers/telegram/verification.js";
import { regionsRoutes } from "./routes/regions.js";
import { smsRoutes } from "./routes/sms.js";
import { telegramRoutes } from "./routes/telegram.js";

const app = new Elysia()
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: {
          title: "unified-sms",
          version: "0.1.0",
          description:
            "The easiest SMS hub — send and verify OTP codes across multiple providers and regions.\n\n" +
            "All endpoints require `Authorization: Bearer <API_SECRET>` header, " +
            "except `POST /telegram/webhook`, which is authenticated by Telegram's secret token.",
        },
        tags: [
          { name: "Regions", description: "Query supported country/region codes" },
          { name: "SMS", description: "Send and verify OTP codes" },
          { name: "Telegram", description: "Webhook endpoint called by the Telegram Bot API" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description: "API secret shared with all authorized server-side clients",
            },
          },
        },
      },
    }),
  )
  .use(regionsRoutes)
  .use(smsRoutes)
  .use(telegramRoutes)
  .onStop(async () => {
    if (isTelegramEnabled()) {
      await shutdownTelegramBot();
    }
  })
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { success: false, error: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 422;
      return { success: false, error: error.message };
    }
    console.error("[unhandled error]", error);
    set.status = 500;
    return { success: false, error: "Internal server error" };
  })
  .listen({ hostname: config.hostname, port: config.port });

export type App = typeof app;

startSessionCleanup();

if (isTelegramEnabled()) {
  setupTelegramBot().catch((err) => {
    console.error("[telegram] failed to register webhook:", err);
  });
} else {
  console.log(
    "[telegram] disabled: set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET to enable non-+86 verification",
  );
}

console.log(`Listening on http://${config.hostname}:${app.server?.port}`);
