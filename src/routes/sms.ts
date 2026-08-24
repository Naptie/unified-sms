import { Elysia, t } from "elysia";

import { getT, localeFromAcceptLanguage, type Locale } from "../i18n/index.js";
import { logVerification } from "../logger.js";
import { authPlugin } from "../plugins/auth.js";
import { isValidPhoneEntry } from "../providers/telegram/phone.js";
import {
  createVerificationSession,
  getSessionStatus,
  isTelegramEnabled,
} from "../providers/telegram/verification.js";
import { errorCodeOf } from "../providers/errors.js";
import { getProvider, resolveChannel } from "../providers/registry.js";

const ErrorResponse = t.Object({
  success: t.Literal(false),
  error: t.String(),
});

const SendBody = t.Object({
  phoneNumber: t.String({
    description: "Phone number without the dial code prefix",
    examples: ["13800138000", "4155552671"],
  }),
  dialCode: t.String({
    description: 'Dial code without the leading "+" sign',
    examples: ["86", "1"],
    default: "86",
  }),
  locale: t.Optional(
    t.Enum(
      { en: "en", zh: "zh", ja: "ja" },
      {
        description: "Language for error messages and the Telegram bot conversation",
        default: "en",
        examples: ["zh", "ja"],
      },
    ),
  ),
  codeLength: t.Optional(
    t.Integer({
      description:
        "Desired OTP length. Aliyun: 4–8 (default 4). " + "Ignored for Telegram-verified numbers.",
      minimum: 4,
      maximum: 10,
      examples: [6],
    }),
  ),
  validTime: t.Optional(
    t.Integer({
      description:
        "How long the code stays valid, in seconds. Aliyun: default 300. " +
        "Ignored for Telegram-verified numbers.",
      minimum: 1,
      examples: [300],
    }),
  ),
});

const VerifyBody = t.Object({
  phoneNumber: t.String({
    description: "Phone number without the dial code prefix",
    examples: ["13800138000"],
  }),
  dialCode: t.String({
    description: 'Dial code without the leading "+" sign',
    examples: ["86"],
    default: "86",
  }),
  locale: t.Optional(
    t.Enum(
      { en: "en", zh: "zh", ja: "ja" },
      {
        description: "Language for error messages",
        default: "en",
        examples: ["zh", "ja"],
      },
    ),
  ),
  code: t.String({
    description: "The OTP code received via SMS",
    examples: ["123456"],
  }),
});

export const smsRoutes = new Elysia({ prefix: "/sms" })
  .use(authPlugin)

  // ── POST /sms/send ────────────────────────────────────────────────────────
  .post(
    "/send",
    async ({ body, headers, set }) => {
      const { phoneNumber, dialCode, codeLength, validTime } = body;
      const locale: Locale =
        body.locale ?? localeFromAcceptLanguage(headers["accept-language"]) ?? "en";
      const t = getT(locale);
      const channel = resolveChannel(dialCode);

      if (channel === "telegram") {
        if (!isValidPhoneEntry(dialCode, phoneNumber)) {
          logVerification({
            route: "sms/send",
            dialCode,
            phoneNumber,
            ok: false,
            status: 422,
            code: "invalid_phone",
          });
          set.status = 422;
          return { success: false as const, error: t("sms.send.invalidPhone") };
        }
        if (!isTelegramEnabled()) {
          logVerification({
            route: "sms/send",
            dialCode,
            phoneNumber,
            ok: false,
            status: 502,
            code: "telegram_unavailable",
          });
          set.status = 502;
          return {
            success: false as const,
            error: t("sms.send.telegramUnavailable"),
          };
        }
        try {
          const handoff = await createVerificationSession(phoneNumber, dialCode, locale);
          logVerification({
            route: "sms/send",
            dialCode,
            phoneNumber,
            ok: true,
            status: 200,
            code: "telegram_session_created",
            detail: `session=${handoff.sessionId}`,
          });
          return { success: true as const, method: "telegram" as const, ...handoff };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[sms/send]", message);
          logVerification({
            route: "sms/send",
            dialCode,
            phoneNumber,
            ok: false,
            status: 502,
            code: errorCodeOf(err),
            detail: message,
          });
          set.status = 502;
          return {
            success: false as const,
            error: t("sms.send.startFailed"),
          };
        }
      }

      const provider = getProvider(dialCode);
      if (!provider) {
        console.error(`[sms/send] no SMS provider registered for dial code +${dialCode}`);
        logVerification({
          route: "sms/send",
          dialCode,
          phoneNumber,
          ok: false,
          status: 500,
          code: "no_provider",
        });
        set.status = 500;
        return {
          success: false as const,
          error: t("sms.send.noProvider"),
        };
      }
      try {
        const result = await provider.sendCode(phoneNumber, dialCode, { codeLength, validTime });
        logVerification({
          route: "sms/send",
          dialCode,
          phoneNumber,
          ok: true,
          status: 200,
          code: "otp_sent",
          detail:
            result.requestId !== undefined || result.bizId !== undefined
              ? `requestId=${result.requestId ?? "-"} bizId=${result.bizId ?? "-"}`
              : undefined,
        });
        return { success: true as const, method: "sms" as const, requestId: result.requestId };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[sms/send]", message);
        logVerification({
          route: "sms/send",
          dialCode,
          phoneNumber,
          ok: false,
          status: 502,
          code: errorCodeOf(err),
          detail: message,
        });
        set.status = 502;
        return { success: false as const, error: t("sms.send.sendFailed") };
      }
    },
    {
      body: SendBody,
      response: {
        200: t.Union([
          t.Object({
            success: t.Literal(true),
            method: t.Literal("sms"),
            requestId: t.Optional(
              t.String({ description: "Upstream provider request ID for tracing" }),
            ),
          }),
          t.Object({
            success: t.Literal(true),
            method: t.Literal("telegram"),
            sessionId: t.String({ description: "Unique verification session ID" }),
            deepLink: t.String({
              description: "Telegram deep link the user must open to verify",
            }),
            expiresAt: t.String({
              description: "ISO timestamp after which the session expires",
            }),
            ttl: t.Integer({ description: "Session lifetime in seconds" }),
          }),
        ]),
        422: ErrorResponse,
        500: ErrorResponse,
        502: ErrorResponse,
      },
      detail: {
        summary: "Send OTP or start Telegram verification",
        description:
          "Dispatches an SMS OTP via the appropriate regional provider, or — for numbers " +
          "outside China Mainland — creates a Telegram verification session and returns a " +
          "deep link the user must open in Telegram. Poll GET /sms/status/:sessionId " +
          "until the session is verified.",
        tags: ["SMS"],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // ── POST /sms/verify ──────────────────────────────────────────────────────
  .post(
    "/verify",
    async ({ body, headers, set }) => {
      const { phoneNumber, dialCode, code } = body;
      const locale: Locale =
        body.locale ?? localeFromAcceptLanguage(headers["accept-language"]) ?? "en";
      const t = getT(locale);
      const channel = resolveChannel(dialCode);

      if (channel === "telegram") {
        logVerification({
          route: "sms/verify",
          dialCode,
          phoneNumber,
          ok: false,
          status: 422,
          code: "telegram_channel",
          detail: "verify via Telegram session status, not /sms/verify",
        });
        set.status = 422;
        return {
          success: false as const,
          error: t("sms.verify.telegramChannel"),
        };
      }

      const provider = getProvider(dialCode);
      if (!provider) {
        console.error(`[sms/verify] no SMS provider registered for dial code +${dialCode}`);
        logVerification({
          route: "sms/verify",
          dialCode,
          phoneNumber,
          ok: false,
          status: 500,
          code: "no_provider",
        });
        set.status = 500;
        return {
          success: false as const,
          error: t("sms.verify.noProvider"),
        };
      }
      try {
        const result = await provider.verifyCode(phoneNumber, dialCode, code);
        logVerification({
          route: "sms/verify",
          dialCode,
          phoneNumber,
          ok: result.verified,
          status: 200,
          ...(result.verified ? { code: "verified" as const } : { code: "code_rejected" as const }),
          ...(result.requestId !== undefined ? { detail: `requestId=${result.requestId}` } : {}),
        });
        return { success: true as const, verified: result.verified };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[sms/verify]", message);
        logVerification({
          route: "sms/verify",
          dialCode,
          phoneNumber,
          ok: false,
          status: 502,
          code: errorCodeOf(err),
          detail: message,
        });
        set.status = 502;
        return {
          success: false as const,
          error: t("sms.verify.verifyFailed"),
        };
      }
    },
    {
      body: VerifyBody,
      response: {
        200: t.Object({
          success: t.Literal(true),
          verified: t.Boolean({
            description: "true if the code is valid and not expired, false otherwise",
          }),
        }),
        422: ErrorResponse,
        500: ErrorResponse,
        502: ErrorResponse,
      },
      detail: {
        summary: "Verify OTP",
        description:
          "Checks whether the submitted OTP code is valid for the given phone number. " +
          "Returns verified: false (not an error) when the code is wrong or expired. " +
          "Only applies to SMS-backed numbers (+86).",
        tags: ["SMS"],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // ── GET /sms/status/:sessionId ────────────────────────────────────────────
  .get(
    "/status/:sessionId",
    async ({ params, query, headers, set }) => {
      const locale: Locale =
        query.locale ?? localeFromAcceptLanguage(headers["accept-language"]) ?? "en";
      const t = getT(locale);
      const result = await getSessionStatus(params.sessionId);
      if (!result) {
        set.status = 404;
        return { success: false as const, error: t("sms.status.notFound") };
      }
      if (result.status === "pending") {
        return { success: true as const, status: "pending" as const };
      }
      if (result.status === "verified") {
        return {
          success: true as const,
          status: "verified" as const,
          verifiedNumber: result.verifiedNumber ?? "",
        };
      }
      return { success: true as const, status: "expired" as const };
    },
    {
      params: t.Object({
        sessionId: t.String({ description: "Session ID returned by POST /sms/send" }),
      }),
      query: t.Object({
        locale: t.Optional(
          t.Enum(
            { en: "en", zh: "zh", ja: "ja" },
            {
              description: "Language for error messages",
              default: "en",
              examples: ["zh", "ja"],
            },
          ),
        ),
      }),
      response: {
        200: t.Union([
          t.Object({
            success: t.Literal(true),
            status: t.Literal("pending"),
          }),
          t.Object({
            success: t.Literal(true),
            status: t.Literal("verified"),
            verifiedNumber: t.String({
              description: "E.164 number confirmed via the Telegram bot",
            }),
          }),
          t.Object({
            success: t.Literal(true),
            status: t.Literal("expired"),
          }),
        ]),
        404: ErrorResponse,
      },
      detail: {
        summary: "Get Telegram verification status",
        description:
          "Polls the state of a Telegram verification session. Poll every 2–3 seconds " +
          "after handing the deep link to the user; stop on verified or expired.",
        tags: ["SMS"],
        security: [{ bearerAuth: [] }],
      },
    },
  );
