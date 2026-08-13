/**
 * Phone number normalization for matching Telegram-shared contacts
 * against the number a user entered on the website.
 */

const digitsOnly = (input: string): string => input.replace(/\D/g, "");

const stripLeadingZeros = (input: string): string => input.replace(/^0+/, "");

/**
 * Builds the expected E.164 digit string from the dial code + local number
 * the user submitted. Tolerates a trunk prefix "0" in the local part and a
 * duplicated dial code (e.g. dialCode "1" with number "14155552671").
 */
export function toExpectedInternational(dialCode: string, phoneNumber: string): string {
  const dialDigits = digitsOnly(dialCode);
  let local = digitsOnly(phoneNumber);
  if (dialDigits && local.startsWith(dialDigits)) {
    local = local.slice(dialDigits.length);
  }
  return dialDigits + stripLeadingZeros(local);
}

/** Digit string of a phone number as reported by Telegram (E.164). */
export function toSharedInternational(phoneNumber: string): string {
  return digitsOnly(phoneNumber);
}

/**
 * Basic sanity check for a phone entry before a verification session is created.
 * E.164 numbers range from 6 to 15 digits total.
 */
export function isValidPhoneEntry(dialCode: string, phoneNumber: string): boolean {
  const dialDigits = digitsOnly(dialCode);
  if (dialDigits.length < 1 || dialDigits.length > 4) return false;
  const total = toExpectedInternational(dialCode, phoneNumber);
  return total.length >= 6 && total.length <= 15;
}
