/** Header detection for uploaded sheets (spec 6.4): case-insensitive with synonyms. */

export type ColumnKey = "name" | "email" | "phone" | "time" | "status";

export const COLUMN_SYNONYMS: Record<ColumnKey, string[]> = {
  name: ["name", "full name", "fullname", "member name", "attendee", "attendee name", "participant", "names"],
  email: ["email", "e-mail", "email address", "e-mail address", "mail", "emails"],
  phone: ["phone", "phone number", "mobile", "mobile number", "telephone", "tel", "whatsapp"],
  time: ["check-in time", "check in time", "checkin time", "time", "time in", "arrival time", "joined at", "join time"],
  status: ["status", "attendance", "present"],
};

export const REQUIRED_COLUMNS: ColumnKey[] = ["name", "email"];

const clean = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/\s*-\s*/g, "-");

export type ColumnMap = Partial<Record<ColumnKey, number>>;

export interface DetectResult {
  map: ColumnMap;
  missing: ColumnKey[];
}

/** Map each known column to the index of the first matching header. */
export function detectColumns(headers: string[]): DetectResult {
  const map: ColumnMap = {};
  const cleaned = headers.map((h) => clean(String(h ?? "")));
  (Object.keys(COLUMN_SYNONYMS) as ColumnKey[]).forEach((key) => {
    const synonyms = COLUMN_SYNONYMS[key].map(clean);
    const idx = cleaned.findIndex((h, i) => synonyms.includes(h) && !Object.values(map).includes(i));
    if (idx !== -1) map[key] = idx;
  });
  return { map, missing: REQUIRED_COLUMNS.filter((k) => map[k] === undefined) };
}
