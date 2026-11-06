import { apiRequest, type ApiFailure } from "./api-client";

export const ACCEPTED_UPLOADS = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Browser upload of a proof, photo or issue picture to /api/v1/files. */
export async function uploadFile(
  file: File,
  purpose: "excuse-proof" | "avatar" | "issue-photo",
): Promise<{ ok: true; url: string; name: string } | ApiFailure> {
  if (!ACCEPTED_UPLOADS.includes(file.type as (typeof ACCEPTED_UPLOADS)[number])) {
    return { ok: false, status: 415, code: "UNSUPPORTED_TYPE", message: "Choose a PNG, JPEG or WebP image, or a PDF." };
  }
  if (file.size > MAX_UPLOAD_BYTES)
    return { ok: false, status: 413, code: "TOO_LARGE", message: "Files must be 2 MB or smaller." };
  const data = await toBase64(file);
  return apiRequest<{ url: string; name: string }>("/api/v1/files", {
    body: { name: file.name, type: file.type, data, purpose },
  });
}
