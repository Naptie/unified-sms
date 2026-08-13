![unified-sms](https://socialify.git.ci/Naptie/unified-sms/image?font=Raleway&forks=1&issues=1&language=1&name=1&owner=1&pattern=Circuit+Board&pulls=1&stargazers=1&theme=Auto)

A lightweight SMS hub for sending and verifying OTP codes. It exposes a single authenticated HTTP API that routes requests to the appropriate upstream SMS provider based on the destination dial code, so your apps never have to care about which carrier handles which region.

Built with [Bun](https://bun.sh) and [Elysia](https://elysiajs.com). A publishable Eden Treaty client is generated from the app's own type signature on every push to `main`, giving consumers end-to-end TypeScript types with no hand-written contracts.

## Overview

- **Main features:** list supported countries/regions, send an OTP, verify an OTP, verify a phone number via Telegram
- **Provider-based routing:** each dial code maps to exactly one provider; adding a new region means adding one file and one registry entry
- **Bearer token auth** on every route — intended to be called only from trusted server-side code on the same machine
- **Interactive API docs** at `/swagger` (Swagger UI, OpenAPI 3.0)
- **Current providers:** Aliyun Dypnsapi for +86 (China Mainland); every other number is verified for free via a Telegram bot contact-sharing flow

---

## Requirements

- [Bun](https://bun.sh) ≥ 1.1
- Upstream providers setup
  - [Aliyun](https://dypns.console.aliyun.com/smsServiceOverview)
  - [Telegram bot](https://t.me/BotFather) (optional — enables verification for non-+86 numbers)

---

## Local development

```bash
git clone https://github.com/Naptie/unified-sms.git
cd unified-sms

bun install

cp .env.example .env
# Fill in .env

bun run dev
```

The server starts on `http://127.0.0.1:3000` by default. Visit `http://127.0.0.1:3000/swagger` to explore the API interactively.

```bash
bun run typecheck   # type-check without running
```

---

## Configuration

All configuration comes from environment variables. The server refuses to start if any required variable is absent.

| Variable                   | Required | Default     | Description                                                                                                                                                 |
| -------------------------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOST`                     |          | `127.0.0.1` | Bind address. Leave as `127.0.0.1` for local-only access. Set to `0.0.0.0` only if you are deliberately exposing the port — see [Deployment](#deployment).  |
| `PORT`                     |          | `3000`      | Listen port                                                                                                                                                 |
| `API_SECRET`               | ✓        | —           | Shared secret. All requests must carry `Authorization: Bearer <API_SECRET>`.                                                                                |
| `REDIS_URI`                | ✓        | —           | Redis connection string used as the Telegram verification session store, e.g. `redis://localhost:6379`. Requires Redis 6.0+.                                           |
| `ALIYUN_ACCESS_KEY_ID`     | ✓        | —           | Aliyun RAM access key ID                                                                                                                                    |
| `ALIYUN_ACCESS_KEY_SECRET` | ✓        | —           | Aliyun RAM access key secret                                                                                                                                |
| `ALIYUN_SIGN_NAME`         | ✓        | —           | SMS sign name as configured in the Aliyun console                                                                                                           |
| `ALIYUN_TEMPLATE_CODE`     | ✓        | —           | SMS template code. The template must accept `code` and `min` parameters.                                                                                    |
| `TELEGRAM_BOT_TOKEN`       | \*       | —           | Bot token from BotFather. Together with the next two variables, enables Telegram verification for non-+86 numbers.                                          |
| `TELEGRAM_WEBHOOK_URL`     | \*       | —           | Public HTTPS URL Telegram should POST updates to, e.g. `https://sms.example.com/telegram/webhook`. Must reach this process (typically via a reverse proxy). |
| `TELEGRAM_WEBHOOK_SECRET`  | \*       | —           | Random secret registered with Telegram via `setWebhook`; every webhook call must carry it in the `X-Telegram-Bot-Api-Secret-Token` header.                  |
| `TELEGRAM_SESSION_TTL`     |          | `600`       | How long a Telegram verification session stays valid, in seconds.                                                                                           |
| `TELEGRAM_MAX_CONNECTIONS` |          | `5`         | Max simultaneous webhook delivery connections Telegram may open (1–100). Keep low when the webhook path runs over an SSH tunnel or CDN chain.               |

\_The three `TELEGRAM\__`values marked with`\*` are all-or-nothing: set all of them to enable the Telegram fallback, or leave them all empty to disable it.

See `.env.example` for a ready-to-fill template.

---

## API

All routes require `Authorization: Bearer <API_SECRET>`.

### `GET /regions`

Returns the list of supported country/region dial codes, each with display names in English, Chinese and Japanese. The data is generated by `bun run build:data` from the [worldwide-regions](https://github.com/Naptie/worldwide-regions) pipeline (multilingual, PRC-compliant names) joined with [libphonenumber](https://www.npmjs.com/package/libphonenumber-js) E.164 dial codes.

**Response `200`**

```json
[
  {
    "dialCode": "86",
    "isoCode": "CN",
    "regionId": "CN",
    "name": { "en": "China Mainland", "zh": "中国大陆", "ja": "中国本土" },
    "method": "sms"
  },
  {
    "dialCode": "886",
    "isoCode": "CN",
    "regionId": "CN-71",
    "name": { "en": "Taiwan, China", "zh": "中国台湾", "ja": "中国台湾" },
    "method": "telegram"
  }
]
```

Compliance notes: Taiwan, Hong Kong and Macau are listed under China (`CN-71`, `CN-81`, `CN-82`) with their own dial codes (+886/+852/+853); Kosovo is not listed (reparented to Serbia upstream).

---

### `POST /sms/send`

Triggers an OTP to be sent (SMS-backed numbers) or creates a Telegram verification session (all other numbers). The hub selects the channel based on `dialCode`: `86` → SMS, anything else → Telegram.

**Request body**

| Field         | Type                 | Required | Description                                                                                                                                                                                                  |
| ------------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `phoneNumber` | string               | ✓        | Phone number without dial code, e.g. `"13800138000"`                                                                                                                                                         |
| `dialCode`    | string               | ✓        | Dial code without the `+` sign, e.g. `"86"`                                                                                                                                                                  |
| `locale`      | `en` \| `zh` \| `ja` |          | Language for error messages and the Telegram bot conversation. Optional — when absent, inferred from the `Accept-Language` request header (q-values and region subtags honored), otherwise defaults to `en`. |
| `codeLength`  | integer (4–10)       |          | OTP digit count. Aliyun default: 4. Ignored for Telegram sessions.                                                                                                                                           |
| `validTime`   | integer (≥ 1)        |          | Code TTL in seconds. Aliyun default: 300. Ignored for Telegram sessions.                                                                                                                                     |

**Response `200`** — SMS channel (`method: "sms"`)

```json
{ "success": true, "method": "sms", "requestId": "abc123" }
```

**Response `200`** — Telegram channel (`method: "telegram"`)

```json
{
  "success": true,
  "method": "telegram",
  "sessionId": "abc123",
  "deepLink": "https://t.me/YourAppVerificationBot?start=zh_abc123",
  "expiresAt": "2026-08-13T10:30:00.000Z",
  "ttl": 600
}
```

**Errors:** `422` for invalid phone entry or unsupported country/region, `502` if the upstream provider returns an error or Telegram verification is not configured.

---

### `POST /sms/verify`

Checks whether the provided code is correct and still valid. Verification is delegated entirely to the upstream provider — the hub never stores or sees the raw code. Only applies to SMS-backed numbers (+86).

**Request body**

| Field         | Type                 | Required | Description                                                                                                                          |
| ------------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `phoneNumber` | string               | ✓        | Same number used in the send call                                                                                                    |
| `dialCode`    | string               | ✓        | Dial code without the `+` sign                                                                                                       |
| `locale`      | `en` \| `zh` \| `ja` |          | Language for error messages. Optional — when absent, inferred from the `Accept-Language` request header, otherwise defaults to `en`. |
| `code`        | string               | ✓        | OTP code entered by the user                                                                                                         |

**Response `200`**

```json
{ "success": true, "verified": true }
```

**Errors:** `422` for non-SMS numbers (use the status endpoint instead), `502` if the upstream provider returns an error.

---

### `GET /sms/status/:sessionId`

Polls the state of a Telegram verification session. Call this every 2–3 seconds after handing the `deepLink` to the user, and stop on `verified` or `expired`.

Accepts an optional `?locale=en|zh|ja` query parameter for the language of error messages; when absent, the `Accept-Language` request header is used, defaulting to `en`.

**Response `200`**

```json
{ "success": true, "status": "pending" }
{ "success": true, "status": "verified", "verifiedNumber": "+14155552671" }
{ "success": true, "status": "expired" }
```

**Errors:** `404` for an unknown session id.

---

### `POST /telegram/webhook`

Called by Telegram whenever the bot receives a message. This is the only endpoint that does not require the Bearer API secret — it is authenticated by the `X-Telegram-Bot-Api-Secret-Token` header matching `TELEGRAM_WEBHOOK_SECRET`. You should not call it yourself.

---

## Telegram verification flow

When the hub routes a number to the Telegram channel:

1. The consumer app shows the user the `deepLink` returned by `POST /sms/send` ("click the link below to open our Telegram bot"). The deep link carries the requested `locale` in its `start` payload, so the bot replies in the same language as the app (English, Chinese or Japanese; default English).
2. The user taps **Start**; the bot binds the session to their Telegram chat and shows a **Share Phone Number** button (Telegram's native `request_contact` keyboard, localized to the session language).
3. The bot checks the shared contact:
   - `contact.user_id` must equal the sender's Telegram user id, guaranteeing the user shares their own account's number rather than an arbitrary address-book entry;
   - the shared number, normalized to E.164 digits, must match the number entered on the website.
4. On success the session becomes `verified` and the consumer app's poll of `GET /sms/status/:sessionId` returns the confirmed E.164 number.

Security notes: sessions are single-use, expire after `TELEGRAM_SESSION_TTL` seconds, and their ids are unguessable (`crypto.randomUUID`). A Telegram contact share is a weaker proof of ownership than an SMS OTP (numbers can be recycled or changed), so treat it as best-effort verification, not strong authentication.

---

## Deployment

1. **Build** the app by running `bun run build`
2. **Start** the app with `bun build/index.js`

The intended setup is local deployment on a private server, bound to `127.0.0.1` so it is reachable only by other services on the same machine. The GitHub Actions workflow builds a Bun bundle, uploads it as a run artifact, and calls a webhook on your server to pull and restart the process. You may need to figure out the exact workflow manually, as this is out of the current repo's scope.

If you're willing to access this application remotely, ensure the `HOST` environment variable is set to `0.0.0.0`.

---

## Typed client

A fully typed [Eden Treaty](https://elysiajs.com/eden/treaty/overview) client is published to the `client` branch of this repository on every push to `main`. The types are generated by `tsup` from the server's own TypeScript app type — no separate API description file to maintain.

### Installing

```bash
# pnpm
pnpm add github:Naptie/unified-sms#client

# npm
npm install github:Naptie/unified-sms#client

# bun
bun add github:Naptie/unified-sms#client
```

Peer dependencies (install alongside):

```bash
pnpm add elysia @elysia/eden
```

### Usage

```ts
import { createClient } from "unified-sms-client";

const sms = createClient("http://127.0.0.1:3000", {
  headers: {
    authorization: "Bearer your-api-secret",
  },
});

// Send an OTP
const { data, error } = await sms.sms.send.post({
  phoneNumber: "13800138000",
  dialCode: "86",
  codeLength: 6,
  validTime: 300,
});

if (error) {
  console.error("Send failed:", error.value);
} else {
  console.log("Sent, requestId:", data.requestId);
}

// Verify an OTP
const { data: result } = await sms.sms.verify.post({
  phoneNumber: "13800138000",
  dialCode: "86",
  code: userInputCode,
});

if (result?.verified) {
  // phone number ownership confirmed
}

// Verify a phone number via Telegram (non-+86 numbers)
const { data: handoff, error: sendError } = await sms.sms.send.post({
  phoneNumber: "4155552671",
  dialCode: "1",
});

if (sendError) {
  console.error("Send failed:", sendError.value);
} else if (handoff?.method === "telegram") {
  // Show the user the deep link: "To verify your number for free,
  // please click the link below to open our Telegram bot."
  console.log("Open in Telegram:", handoff.deepLink);

  // Poll until the user shares their number in the bot
  for (let i = 0; i < handoff.ttl / 2; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const { data: status } = await sms.status.get(handoff.sessionId);
    if (status?.status === "verified") {
      console.log("Verified number:", status.verifiedNumber);
      break;
    }
    if (status?.status === "expired") {
      console.error("Verification session expired");
      break;
    }
  }
}
```

All request fields, response shapes, and error payloads are typed automatically from the server schema. No type assertions needed.

### Keeping types up to date

The `client` branch is force-pushed on every `main` commit. If you installed via a lockfile-pinned git reference, re-run your package manager's install command after pulling to pick up type changes.
