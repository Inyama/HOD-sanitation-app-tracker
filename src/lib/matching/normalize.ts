/** Normalisation for sheet matching (spec 6.4). */

export const normalizeEmail = (s: string) => s.trim().toLowerCase();

/** Accents removed, lower case, punctuation dropped, words sorted so order does not matter. */
export const normalizeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const looksLikeEmail = (s: string) => EMAIL_RE.test(s.trim());
