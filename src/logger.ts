/**
 * Mask a phone number for logs: keeps the first three and last two digits and
 * masks everything in between (minimum four asterisks).
 * e.g. "13800138000" -> "138*******00", "4155552671" -> "415*****71"
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 5) return "*".repeat(phoneNumber.length);
  const head = phoneNumber.slice(0, 3);
  const tail = phoneNumber.slice(-2);
  return `${head}${"*".repeat(Math.max(4, phoneNumber.length - 5))}${tail}`;
}

export interface VerificationLog {
  /** Route tag, e.g. "sms/send" or "sms/verify" */
  route: string;
  /** Full dial code, without the leading "+" */
  dialCode: string;
  /** Phone number without dial code; masked before logging */
  phoneNumber?: string;
  ok: boolean;
  /** HTTP status returned to the caller */
  status?: number;
  /** Machine-readable error/outcome code (upstream provider code when available) */
  code?: string;
  /** Optional human-readable detail */
  detail?: string;
}

/** Emits one greppable line per verification request outcome. */
export function logVerification(entry: VerificationLog): void {
  const parts = [
    `[${entry.route}]`,
    entry.ok ? "ok" : "fail",
    `dial=${entry.dialCode}`,
    ...(entry.phoneNumber !== undefined ? [`phone=${maskPhoneNumber(entry.phoneNumber)}`] : []),
    ...(entry.status !== undefined ? [`status=${entry.status}`] : []),
    ...(entry.code !== undefined ? [`code=${entry.code}`] : []),
    ...(entry.detail !== undefined ? [`msg="${entry.detail}"`] : []),
  ];
  const line = parts.join(" ");
  if (entry.ok) {
    console.log(line);
  } else {
    console.error(line);
  }
}
