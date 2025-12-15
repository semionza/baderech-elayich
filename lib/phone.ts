// lib/phone.ts

/**
 * Convert Israeli phone numbers into E.164 format for Twilio.
 *
 * Examples:
 * 0545555555       → +972545555555
 * 545555555        → +972545555555
 * +972545555555    → +972545555555
 * 972545555555     → +972545555555
 */
export function normalizeIsraeliPhone(phone: string): string | null {
  if (!phone) return null;

  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[^0-9+]/g, "");

  // Already in correct E.164 international format
  if (cleaned.startsWith("+972") && cleaned.length >= 12) {
    return cleaned;
  }

  // Starts with 972 but missing +
  if (cleaned.startsWith("972") && cleaned.length >= 11) {
    return "+" + cleaned;
  }

  // Local Israeli mobile numbers like: 054xxxxxxx, 052xxxxxxx, etc.
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+972" + cleaned.slice(1);
  }

  // Mobile number without leading zero: 545555555
  if (/^[2-9]\d{7,8}$/.test(cleaned)) {
    return "+972" + cleaned;
  }

  // If none matched, fallback: prepend +972
  if (/^\d+$/.test(cleaned)) {
    return "+972" + cleaned;
  }

  return null;
}
