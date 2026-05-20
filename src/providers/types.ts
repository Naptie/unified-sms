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
 * Upstream SMS provider interface.
 * Implement this to add a new provider (e.g. Twilio, AWS SNS).
 */
export interface SmsProvider {
  /**
   * Send an OTP code via SMS. The provider generates and tracks the code internally.
   * @param phoneNumber - Phone number without the country code prefix
   * @param countryCode - Dial code (e.g. "86")
   */
  sendCode(phoneNumber: string, countryCode: string): Promise<SendCodeResult>;

  /**
   * Verify an OTP code submitted by the user.
   * @param phoneNumber - Phone number without the country code prefix
   * @param countryCode - Dial code (e.g. "86")
   * @param code - The code the user submitted
   */
  verifyCode(phoneNumber: string, countryCode: string, code: string): Promise<VerifyCodeResult>;
}
