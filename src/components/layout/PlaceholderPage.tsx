import "server-only";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth/session";
import { ComingSoon } from "./ComingSoon";
import { SCREENS } from "./screens";

/** Catch-all for screens not built yet: 404 for unknown paths, guard plus placeholder for known ones. */
export async function PlaceholderPage({
  area,
  params,
}: {
  area: "member" | "volunteer" | "admin";
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = `/${area}/${slug.join("/")}`;
  const info = SCREENS[path];
  if (!info) notFound();
  await requirePage(path);
  return <ComingSoon title={info.title} phase={info.phase} points={info.points} />;
}
