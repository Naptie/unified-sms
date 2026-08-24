import Dypnsapi20170525, * as $Dypnsapi20170525 from "@alicloud/dypnsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

import { config } from "../config.js";
import { errorCodeOf, ProviderError } from "./errors.js";
import type { SendCodeOptions, SendCodeResult, SmsProvider, VerifyCodeResult } from "./types.js";

/**
 * Aliyun's code for a wrong, expired, or superseded OTP — an expected
 * verification outcome, not a provider fault (see the PNVS API return-code
 * table: help.aliyun.com/zh/pnvs/developer-reference/api-return-code).
 * CheckSmsVerifyCode answers it with HTTP 400, which the OpenAPI client
 * rethrows as an error carrying this code.
 */
const VERIFY_FAILED = "isv.ValidateFail";

/**
 * Aliyun (Alibaba Cloud) Dypnsapi SMS provider.
 * Handles OTP generation, delivery, and verification for +86 (China Mainland) numbers.
 * Aliyun manages the OTP lifecycle internally; we never see the raw code.
 */
export class AliyunProvider implements SmsProvider {
  private readonly client: Dypnsapi20170525;

  constructor() {
    const apiConfig = new $OpenApi.Config({
      accessKeyId: config.aliyun.accessKeyId,
      accessKeySecret: config.aliyun.accessKeySecret,
    });
    apiConfig.endpoint = "dypnsapi.aliyuncs.com";
    this.client = new Dypnsapi20170525(apiConfig);
  }

  async sendCode(
    phoneNumber: string,
    dialCode: string,
    options?: SendCodeOptions,
  ): Promise<SendCodeResult> {
    const mins = (options?.validTime ?? 300) / 60;
    const minStr = Number.isInteger(mins) ? String(mins) : mins.toFixed(1);

    const request = new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber,
      dialCode,
      signName: config.aliyun.signName,
      templateCode: config.aliyun.templateCode,
      templateParam: `{"code":"##code##","min":"${minStr}"}`,
      ...(options?.codeLength !== undefined && { codeLength: options.codeLength }),
      ...(options?.validTime !== undefined && { validTime: options.validTime }),
    });
    const runtime = new $Util.RuntimeOptions({});

    const response = await this.client.sendSmsVerifyCodeWithOptions(request, runtime);
    const body = response.body;

    if (!body) throw new Error("Empty response from Aliyun SendSmsVerifyCode");
    if (body.code !== "OK") {
      throw new ProviderError(
        "aliyun",
        body.code ?? "UNKNOWN",
        body.message ?? `Aliyun error code: ${body.code}`,
        body.requestId ?? undefined,
      );
    }

    return {
      requestId: body.model?.requestId ?? undefined,
      bizId: body.model?.bizId ?? undefined,
    };
  }

  async verifyCode(phoneNumber: string, dialCode: string, code: string): Promise<VerifyCodeResult> {
    const request = new $Dypnsapi20170525.CheckSmsVerifyCodeRequest({
      phoneNumber,
      dialCode,
      verifyCode: code,
    });
    const runtime = new $Util.RuntimeOptions({});

    try {
      const response = await this.client.checkSmsVerifyCodeWithOptions(request, runtime);
      const body = response.body;

      if (!body) throw new Error("Empty response from Aliyun CheckSmsVerifyCode");
      if (body.code === VERIFY_FAILED) return { verified: false };
      if (body.code !== "OK") {
        throw new ProviderError(
          "aliyun",
          body.code ?? "UNKNOWN",
          body.message ?? `Aliyun error code: ${body.code}`,
          body.requestId ?? undefined,
        );
      }

      return {
        verified: body.model?.verifyResult === "PASS",
        requestId: body.requestId ?? undefined,
      };
    } catch (err: unknown) {
      // Wrong/expired/superseded codes arrive as HTTP 400 -> TeaException
      // with code isv.ValidateFail; translate them into a normal miss.
      if (errorCodeOf(err) === VERIFY_FAILED) {
        return { verified: false };
      }
      throw err;
    }
  }
}
