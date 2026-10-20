/**
 * Open-redirect protection: only same-origin, absolute-path destinations are
 * allowed. Anything else (protocol-relative, backslash tricks, javascript:,
 * encoded schemes) falls back to the safe default.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  // must be a single leading slash, not // or /\ (protocol-relative / backslash bypass)
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return fallback;
  }
  // reject control characters and schemes smuggled through encoding
  if (/[\u0000-\u001f]/.test(decoded)) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(decoded)) return fallback;
  return decoded;
}
