import manifest from "../../../public/images/photos/photos.json";

export type PhotoSlot =
  | "church-interior"
  | "volunteers-cleaning"
  | "sparkling-floor"
  | "cleaning-supplies"
  | "team-aprons"
  | "city-sunrise"
  | "mop-bucket"
  | "clean-lobby";

export interface PhotoEntry {
  slot: PhotoSlot;
  /** Path under /public, or null while the slot uses a generated placeholder. */
  file: string | null;
  alt: string;
  photographer: string | null;
  sourceUrl: string | null;
  license: string | null;
  placeholder: { gradient: string; pattern: "dots" | "grid" | "waves" | "rays" };
}

export const photos = manifest.photos as PhotoEntry[];

export function getPhoto(slot: PhotoSlot): PhotoEntry {
  const found = photos.find((p) => p.slot === slot);
  if (!found) throw new Error(`Unknown photo slot: ${slot}`);
  return found;
}

/** Credits to render in the landing footer: only real photos with a photographer. */
export function photoCredits(): PhotoEntry[] {
  return photos.filter((p) => p.file && p.photographer && p.sourceUrl);
}
