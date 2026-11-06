import { createHmac, randomBytes } from "node:crypto";

/**
 * TOTP two-factor codes (RFC 6238, SHA-1, 30-second steps, 6 digits) for admins.
 * Built on node:crypto; Phase 8 may swap in otplib behind the same functions.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(
  secret: Buffer,
  counter: number,
  digits = 6,
  algorithm: "sha1" | "sha256" | "sha512" = "sha1",
): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac(algorithm, secret).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totp(secretBase32: string, nowMs: number, step = 30, digits = 6): string {
  return hotp(base32Decode(secretBase32), Math.floor(nowMs / 1000 / step), digits);
}

/** Accepts the current code and one step either side for clock drift. */
export function verifyTotp(secretBase32: string, code: string, nowMs: number, window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(nowMs / 1000 / 30);
  for (let w = -window; w <= window; w++) if (hotp(secret, counter + w) === code) return true;
  return false;
}

export function otpauthUri(secretBase32: string, account: string, issuer = "HOD Sanitation Hub"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
