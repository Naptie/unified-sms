/**
 * Error thrown by SMS providers when the upstream API answers with a
 * non-OK business code. Carries the upstream error code (e.g. Aliyun's
 * "isv.MOBILE_NUMBER_ILLEGAL") so route handlers can log it verbatim.
 */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Best-effort machine-readable code for a thrown error:
 * ProviderError.code, then any string `code` property (e.g. TeaException),
 * falling back to "internal_error".
 */
export function errorCodeOf(err: unknown): string {
  if (err instanceof ProviderError) return err.code;
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code.length > 0) return code;
  return "internal_error";
}
