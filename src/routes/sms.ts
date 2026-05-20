import { Elysia, t } from "elysia";

import { authPlugin } from "../plugins/auth.js";
import { getProvider, isSupportedCountry } from "../providers/registry.js";

const ErrorResponse = t.Object({
  success: t.Literal(false),
  error: t.String(),
});

const SendBody = t.Object({
  phoneNumber: t.String({
    description: "Phone number without the country code prefix",
    examples: ["13800138000"],
  }),
  countryCode: t.String({
    description: 'Dial code without the leading "+" sign',
    examples: ["86"],
    default: "86",
  }),
  codeLength: t.Optional(
    t.Integer({
      description:
        "Desired OTP length. Aliyun: 4–8 (default 4). " +
        "Ignored by providers that set code length at the service level (e.g. Twilio).",
      minimum: 4,
      maximum: 10,
      examples: [6],
    }),
  ),
  validTime: t.Optional(
    t.Integer({
      description:
        "How long the code stays valid, in seconds. Aliyun: default 300. " +
        "Ignored by providers that set TTL at the service level (e.g. Twilio).",
      minimum: 1,
      examples: [300],
    }),
  ),
});

const VerifyBody = t.Object({
  phoneNumber: t.String({
    description: "Phone number without the country code prefix",
    examples: ["13800138000"],
  }),
  countryCode: t.String({
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
      const { phoneNumber, countryCode, codeLength, validTime } = body;

      if (!isSupportedCountry(countryCode)) {
        set.status = 422;
        return {
          success: false as const,
          error: `Country code +${countryCode} is not supported`,
        };
      }

      const provider = getProvider(countryCode)!;
      try {
        const result = await provider.sendCode(phoneNumber, countryCode, { codeLength, validTime });
        return { success: true as const, requestId: result.requestId };
      } catch (err: unknown) {
        console.error("[sms/send]", err instanceof Error ? err.message : err);
        set.status = 502;
        return { success: false as const, error: "Failed to send SMS. Please try again later." };
      }
    },
    {
      body: SendBody,
      response: {
        200: t.Object({
          success: t.Literal(true),
          requestId: t.Optional(
            t.String({ description: "Upstream provider request ID for tracing" }),
          ),
        }),
        422: ErrorResponse,
        502: ErrorResponse,
      },
      detail: {
        summary: "Send OTP",
        description:
          "Dispatches an SMS OTP to the specified number via the appropriate regional provider. " +
          "The provider generates and manages the code internally.",
        tags: ["SMS"],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // ── POST /sms/verify ──────────────────────────────────────────────────────
  .post(
    "/verify",
    async ({ body, set }) => {
      const { phoneNumber, countryCode, code } = body;

      if (!isSupportedCountry(countryCode)) {
        set.status = 422;
        return {
          success: false as const,
          error: `Country code +${countryCode} is not supported`,
        };
      }

      const provider = getProvider(countryCode)!;
      try {
        const result = await provider.verifyCode(phoneNumber, countryCode, code);
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
        502: ErrorResponse,
      },
      detail: {
        summary: "Verify OTP",
        description:
          "Checks whether the submitted OTP code is valid for the given phone number. " +
          "Returns verified: false (not an error) when the code is wrong or expired.",
        tags: ["SMS"],
        security: [{ bearerAuth: [] }],
      },
    },
  );
