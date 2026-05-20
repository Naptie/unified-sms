import Dypnsapi20170525, * as $Dypnsapi20170525 from "@alicloud/dypnsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

import { config } from "../config.js";
import type { SendCodeResult, SmsProvider, VerifyCodeResult } from "./types.js";

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

  async sendCode(phoneNumber: string, countryCode: string): Promise<SendCodeResult> {
    const request = new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber,
      countryCode,
      signName: config.aliyun.signName,
      templateCode: config.aliyun.templateCode,
      templateParam: config.aliyun.templateParam,
    });
    const runtime = new $Util.RuntimeOptions({});

    const response = await this.client.sendSmsVerifyCodeWithOptions(request, runtime);
    const body = response.body;

    if (!body) throw new Error("Empty response from Aliyun SendSmsVerifyCode");
    if (body.code !== "OK") {
      throw new Error(body.message ?? `Aliyun error code: ${body.code}`);
    }

    return {
      requestId: body.model?.requestId ?? undefined,
      bizId: body.model?.bizId ?? undefined,
    };
  }

  async verifyCode(
    phoneNumber: string,
    countryCode: string,
    code: string,
  ): Promise<VerifyCodeResult> {
    const request = new $Dypnsapi20170525.CheckSmsVerifyCodeRequest({
      phoneNumber,
      countryCode,
      verifyCode: code,
    });
    const runtime = new $Util.RuntimeOptions({});

    const response = await this.client.checkSmsVerifyCodeWithOptions(request, runtime);
    const body = response.body;

    if (!body) throw new Error("Empty response from Aliyun CheckSmsVerifyCode");
    if (body.code !== "OK") {
      throw new Error(body.message ?? `Aliyun error code: ${body.code}`);
    }

    return {
      verified: body.model?.verifyResult === "PASS",
      requestId: body.requestId ?? undefined,
    };
  }
}
