import { NextResponse, type NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { apiError, parseJson } from "@/lib/http";
import { fileUpload } from "@/lib/validation/member";
import { authStore } from "@/lib/auth/store";
import { randomToken } from "@/lib/auth/tokens";
import { now } from "@/lib/time/clock";

const MAX_BYTES = 2 * 1024 * 1024;

/** Checks the first bytes so a renamed file cannot pass as an image or PDF. */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

/**
 * POST /api/v1/files: upload an excuse proof, profile photo or issue photo (images or PDF, 2 MB).
 * Stored in memory until Phase 8 adds object storage.
 */
export async function POST(req: NextRequest) {
  const auth = await apiUser("attendance.own");
  if (!auth.ok) return auth.res;
  const body = await parseJson(req, fileUpload);
  if (!body.ok) return body.res;
  const buf = Buffer.from(body.data.data, "base64");
  if (buf.length > MAX_BYTES) return apiError("TOO_LARGE", "Files must be 2 MB or smaller.", 413);
  const kind = sniff(buf);
  if (!kind || kind !== body.data.type)
    return apiError("UNSUPPORTED_TYPE", "Upload a PNG, JPEG or WebP image, or a PDF.", 415);
  if ((body.data.purpose === "avatar" || body.data.purpose === "logo") && kind === "application/pdf")
    return apiError("UNSUPPORTED_TYPE", "A profile photo must be an image.", 415);
  const id = randomToken(12);
  authStore().files.set(id, {
    id,
    ownerId: auth.current.user.id,
    name: body.data.name,
    type: kind,
    data: buf,
    createdAt: now().toISO()!,
  });
  return NextResponse.json(
    { ok: true, url: `/api/v1/files/${id}`, name: body.data.name, size: buf.length },
    { status: 201 },
  );
}
