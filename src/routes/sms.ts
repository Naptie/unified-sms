import { Elysia, t } from "elysia";

import { authPlugin } from "../plugins/auth.js";
import { isValidPhoneEntry } from "../providers/telegram/phone.js";
import {
  createVerificationSession,
  getSessionStatus,
  isTelegramEnabled,
} from "../providers/telegram/verification.js";
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
    async ({ body, set }) => {
      const { phoneNumber, dialCode, codeLength, validTime } = body;
      const channel = resolveChannel(dialCode);

      if (channel === "telegram") {
        if (!isValidPhoneEntry(dialCode, phoneNumber)) {
          set.status = 422;
          return { success: false as const, error: "Invalid phone number or dial code" };
        }
        if (!isTelegramEnabled()) {
          set.status = 502;
          return {
            success: false as const,
            error: "Telegram verification is not configured on this server",
          };
        }
        try {
          const handoff = await createVerificationSession(phoneNumber, dialCode);
          return { success: true as const, method: "telegram" as const, ...handoff };
        } catch (err: unknown) {
          console.error("[sms/send]", err instanceof Error ? err.message : err);
          set.status = 502;
          return {
            success: false as const,
            error: "Failed to start verification. Please try again later.",
          };
        }
      }

      const provider = getProvider(dialCode);
      if (!provider) {
        console.error(`[sms/send] no SMS provider registered for dial code +${dialCode}`);
        set.status = 500;
        return {
          success: false as const,
          error: "No SMS provider is registered for this dial code",
        };
      }
      try {
        const result = await provider.sendCode(phoneNumber, dialCode, { codeLength, validTime });
        return { success: true as const, method: "sms" as const, requestId: result.requestId };
      } catch (err: unknown) {
        console.error("[sms/send]", err instanceof Error ? err.message : err);
        set.status = 502;
        return { success: false as const, error: "Failed to send SMS. Please try again later." };
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
    async ({ body, set }) => {
      const { phoneNumber, dialCode, code } = body;
      const channel = resolveChannel(dialCode);

      if (channel === "telegram") {
        set.status = 422;
        return {
          success: false as const,
          error:
            "Numbers outside China Mainland are verified via the Telegram bot; " +
            "poll GET /sms/status/:sessionId instead of submitting a code.",
        };
      }

      const provider = getProvider(dialCode);
      if (!provider) {
        console.error(`[sms/verify] no SMS provider registered for dial code +${dialCode}`);
        set.status = 500;
        return {
          success: false as const,
          error: "No SMS provider is registered for this dial code",
        };
      }
      try {
        const result = await provider.verifyCode(phoneNumber, dialCode, code);
        return { success: true as const, verified: result.verified };
      } catch (err: unknown) {
        console.error("[sms/verify]", err instanceof Error ? err.message : err);
        set.status = 502;
        return {
          success: false as const,
          error: "Failed to verify code. Please try again later.",
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
    async ({ params, set }) => {
      const result = getSessionStatus(params.sessionId);
      if (!result) {
        set.status = 404;
        return { success: false as const, error: "Unknown verification session" };
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
