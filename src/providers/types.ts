export interface SendCodeResult {
  /** Request ID from the upstream provider for tracing */
  requestId?: string;
  /** Batch/business ID for the SMS dispatch */
  bizId?: string;
}

export interface VerifyCodeResult {
  /** Whether the provided OTP code matches and is still valid */
  verified: boolean;
  /** Request ID from the upstream provider for tracing */
  requestId?: string;
}

/**
 * Optional per-request knobs for OTP generation.
 * Providers that do not support a given option silently ignore it
 * (e.g. Twilio configures code length and TTL at the Service level, not per-call).
 */
export interface SendCodeOptions {
  /**
   * Desired OTP length.
   * Aliyun: 4–8 digits (default 4).
   * Twilio: ignored (configured in Verify Service settings).
   */
  codeLength?: number;
  /**
   * How long the code stays valid, in seconds.
   * Aliyun: default 300 s.
   * Twilio: ignored (fixed 10-minute TTL set in Verify Service settings).
   */
  validTime?: number;
}

/**
 * Upstream SMS provider interface.
 * Implement this to add a new provider (e.g. Twilio, AWS SNS).
 */
export interface SmsProvider {
  /**
   * Send an OTP code via SMS. The provider generates and tracks the code internally.
   * @param phoneNumber - Phone number without the dial code prefix
   * @param dialCode - Dial code (e.g. "86")
   * @param options - Optional generation settings (provider support varies)
   */
  sendCode(
    phoneNumber: string,
    dialCode: string,
    options?: SendCodeOptions,
  ): Promise<SendCodeResult>;

  /**
   * Verify an OTP code submitted by the user.
   * @param phoneNumber - Phone number without the dial code prefix
   * @param dialCode - Dial code (e.g. "86")
   * @param code - The code the user submitted
   */
  verifyCode(phoneNumber: string, dialCode: string, code: string): Promise<VerifyCodeResult>;
}
