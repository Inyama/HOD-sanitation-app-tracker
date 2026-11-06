import { b64urlEncode } from "@/lib/auth/tokens";

/**
 * Rotating check-in code (spec 6.2, optional second proof). The Marshal screen shows a new
 * six-character code every 30 seconds; a member types or scans it. The code is an HMAC of the
 * meeting id and the 30-second window, so it cannot be guessed or reused later.
 */

export const QR_STEP_MS = 30_000;
const enc = new TextEncoder();
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

export async function qrCodeFor(meetingId: string, atMs: number, secret: string): Promise<string> {
  const window = Math.floor(atMs / QR_STEP_MS);
  const bytes = await hmac(secret, `qr:${meetingId}:${window}`);
  return [...bytes.slice(0, 6)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Accepts the current code and the previous one (a scan can straddle a rotation). */
export async function verifyQrCode(
  meetingId: string,
  code: string | undefined,
  atMs: number,
  secret: string,
): Promise<boolean> {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  for (const offset of [0, -QR_STEP_MS]) if ((await qrCodeFor(meetingId, atMs + offset, secret)) === c) return true;
  return false;
}

/** Opaque id for the QR image payload (the app link with the code). */
export function qrPayload(appUrl: string, meetingId: string, code: string): string {
  return `${appUrl}/member/check-in?m=${encodeURIComponent(meetingId)}&code=${code}&n=${b64urlEncode(enc.encode(meetingId)).slice(0, 4)}`;
}
