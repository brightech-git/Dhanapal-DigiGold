// src/utils/tokenUtils.ts
// Lightweight JWT helpers — reads the `exp` claim locally so an expired token
// is dropped before it is ever sent to the server.

const decodeBase64Url = (input: string): string => {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return atob(b64);
};

/** Returns the JWT payload, or null when the token is not a decodable JWT. */
export const decodeJwt = (token: string): Record<string, any> | null => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(decodeBase64Url(part));
  } catch {
    return null;
  }
};

/** Expiry time in ms, or null when the token has no `exp` claim. */
export const getTokenExpiry = (token: string): number | null => {
  const exp = decodeJwt(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
};

/**
 * True when the token is expired (or expires within `skewSeconds`).
 * Tokens without a readable `exp` are treated as valid — the server's 401 decides.
 */
export const isTokenExpired = (token: string | null | undefined, skewSeconds = 30): boolean => {
  if (!token) return true;
  const expiry = getTokenExpiry(token);
  if (expiry === null) return false;
  return Date.now() >= expiry - skewSeconds * 1000;
};
