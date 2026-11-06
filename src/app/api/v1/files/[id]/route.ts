import { getCurrentUser } from "@/lib/auth/session";
import { capabilities } from "@/lib/auth/permissions";
import { authStore } from "@/lib/auth/store";
import { apiError } from "@/lib/http";

/** GET /api/v1/files/:id: the owner, or an admin who reviews excuses or people, can open a file. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current) return apiError("UNAUTHENTICATED", "Please sign in.", 401);
  const { id } = await params;
  const file = authStore().files.get(id);
  if (!file) return apiError("NOT_FOUND", "File not found.", 404);
  const caps = capabilities(current.actor);
  const allowed = file.ownerId === current.user.id || caps.has("excuse.review") || caps.has("people.view");
  if (!allowed) return apiError("FORBIDDEN", "You cannot open this file.", 403);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `inline; filename="${file.name.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
