/**
 * Signed, expiring tokens (HMAC-SHA256 via Web Crypto) used for the session cookie,
 * the two-factor step, email verification and password reset links.
 * Format: base64url(JSON payload) + "." + base64url(signature). Works in Node and in the proxy.
 */

export interface TokenPayload {
  /** Purpose, so a reset token can never be used as a session. */
  typ: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
    keyCache.set(secret, k);
  }
  return k;
}

export async function signToken<T extends TokenPayload>(payload: T, secret: string): Promise<string> {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

/** Returns the payload when the signature is valid, the purpose matches and it has not expired. */
export async function verifyToken<T extends TokenPayload>(
  token: string | undefined | null,
  secret: string,
  typ: string,
  nowMs: number,
): Promise<T | null> {
  if (!token || token.length > 4096) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlDecode(sig), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(dec.decode(b64urlDecode(body))) as T;
    if (payload.typ !== typ || typeof payload.exp !== "number" || payload.exp <= nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}

/** SHA-256 hex digest (invite tokens are stored hashed). */
export async function sha256Hex(s: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64urlEncode(a);
}
