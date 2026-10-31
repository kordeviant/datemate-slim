/**
 * Masks a sensitive push device token so it can be safely returned in responses
 * or logged without exposing full credentials.
 * Example: "fcm_token_1234567890abcdef" -> "fcm_...cdef"
 */
export function maskDeviceToken(token: string | null | undefined): string {
  if (!token) return '[empty]';
  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return '****';
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}
