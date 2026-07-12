![unified-sms](https://socialify.git.ci/Naptie/unified-sms/image?font=Raleway&forks=1&issues=1&language=1&name=1&owner=1&pattern=Circuit+Board&pulls=1&stargazers=1&theme=Auto)

A lightweight SMS hub for sending and verifying OTP codes. It exposes a single authenticated HTTP API that routes requests to the appropriate upstream SMS provider based on the destination dial code, so your apps never have to care about which carrier handles which region.

Built with [Bun](https://bun.sh) and [Elysia](https://elysiajs.com). A publishable Eden Treaty client is generated from the app's own type signature on every push to `main`, giving consumers end-to-end TypeScript types with no hand-written contracts.

## Overview

- **Main features:** list supported countries/regions, send an OTP, verify an OTP
- **Provider-based routing:** each dial code maps to exactly one provider; adding a new region means adding one file and one registry entry
- **Bearer token auth** on every route — intended to be called only from trusted server-side code on the same machine
- **Interactive API docs** at `/swagger` (Swagger UI, OpenAPI 3.0)
- **Current providers:** Aliyun Dypnsapi for +86 (China Mainland)

---

## Requirements

- [Bun](https://bun.sh) ≥ 1.1
- Upstream providers setup
  - [Aliyun](https://dypns.console.aliyun.com/smsServiceOverview)

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

| Variable                   | Required | Default     | Description                                                                                                                                                |
| -------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOST`                     |          | `127.0.0.1` | Bind address. Leave as `127.0.0.1` for local-only access. Set to `0.0.0.0` only if you are deliberately exposing the port — see [Deployment](#deployment). |
| `PORT`                     |          | `3000`      | Listen port                                                                                                                                                |
| `API_SECRET`               | ✓        | —           | Shared secret. All requests must carry `Authorization: Bearer <API_SECRET>`.                                                                               |
| `ALIYUN_ACCESS_KEY_ID`     | ✓        | —           | Aliyun RAM access key ID                                                                                                                                   |
| `ALIYUN_ACCESS_KEY_SECRET` | ✓        | —           | Aliyun RAM access key secret                                                                                                                               |
| `ALIYUN_SIGN_NAME`         | ✓        | —           | SMS sign name as configured in the Aliyun console                                                                                                          |
| `ALIYUN_TEMPLATE_CODE`     | ✓        | —           | SMS template code. The template must accept `code` and `min` parameters.                                                                                   |

See `.env.example` for a ready-to-fill template.

---

## API

All routes require `Authorization: Bearer <API_SECRET>`.

### `GET /countries`

Returns the list of supported country/region codes.

**Response `200`**

```json
[{ "dialCode": "86", "name": "China (Mainland)", "isoCode": "CN" }]
```

---

### `POST /sms/send`

Triggers an OTP to be sent. The hub selects the right provider based on `countryCode`.

**Request body**

| Field         | Type           | Required | Description                                                                                        |
| ------------- | -------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `phoneNumber` | string         | ✓        | Phone number without dial code, e.g. `"13800138000"`                                               |
| `countryCode` | string         | ✓        | Dial code without the `+` sign, e.g. `"86"`                                                        |
| `codeLength`  | integer (4–10) |          | OTP digit count. Aliyun default: 4. Ignored by providers that configure this at the service level. |
| `validTime`   | integer (≥ 1)  |          | Code TTL in seconds. Aliyun default: 300. Ignored by providers with a fixed TTL.                   |

**Response `200`**

```json
{ "success": true, "requestId": "abc123" }
```

`requestId` may be absent if the provider does not return one.

**Errors:** `422` for unsupported country/region or validation failure, `502` if the upstream provider returns an error.

---

### `POST /sms/verify`

Checks whether the provided code is correct and still valid. Verification is delegated entirely to the upstream provider — the hub never stores or sees the raw code.

**Request body**

| Field         | Type   | Required | Description                       |
| ------------- | ------ | -------- | --------------------------------- |
| `phoneNumber` | string | ✓        | Same number used in the send call |
| `countryCode` | string | ✓        | Dial code without the `+` sign    |
| `code`        | string | ✓        | OTP code entered by the user      |

**Response `200`**

```json
{ "success": true, "verified": true }
```

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
  countryCode: "86",
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
  countryCode: "86",
  code: userInputCode,
});

if (result?.verified) {
  // phone number ownership confirmed
}
```

All request fields, response shapes, and error payloads are typed automatically from the server schema. No type assertions needed.

### Keeping types up to date

The `client` branch is force-pushed on every `main` commit. If you installed via a lockfile-pinned git reference, re-run your package manager's install command after pulling to pick up type changes.

---

## Adding a provider

To support a new country or region:

**1. Create the provider**

Add `src/providers/<name>.ts` implementing the `SmsProvider` interface:

```ts
import type { SendCodeOptions, SendCodeResult, SmsProvider, VerifyCodeResult } from "./types.js";

export class TwilioProvider implements SmsProvider {
  async sendCode(
    phoneNumber: string,
    countryCode: string,
    options?: SendCodeOptions,
  ): Promise<SendCodeResult> {
    // call Twilio Verify API
    return { requestId: "..." };
  }

  async verifyCode(
    phoneNumber: string,
    countryCode: string,
    code: string,
  ): Promise<VerifyCodeResult> {
    // call Twilio Verify check API
    return { verified: true };
  }
}
```

**2. Register the provider**

In `src/providers/registry.ts`, add an entry to `SUPPORTED_COUNTRIES` and a case in `getProvider`:

```ts
export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { dialCode: "86", name: "China (Mainland)", isoCode: "CN" },
  { dialCode: "1", name: "United States", isoCode: "US" }, // added
];

export function getProvider(dialCode: string): SmsProvider | undefined {
  if (dialCode === "86") {
    /* existing */
  }

  if (dialCode === "1") {
    if (!instances.has("1")) instances.set("1", new TwilioProvider());
    return instances.get("1");
  }
}
```

**3. Add configuration**

Add any required env vars to `src/config.ts`, the `requireEnv` calls in the provider constructor, and `.env.example`.

The new country/region will appear in `GET /countries` immediately and be routable by the send/verify endpoints.
