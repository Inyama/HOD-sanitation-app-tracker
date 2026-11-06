import { normalizeName } from "./normalize";

/**
 * Name similarity: 1 - edit distance / max length, on normalised names (spec 6.4).
 *
 * The spec's reference uses plain Levenshtein. We use optimal string alignment
 * (Levenshtein plus adjacent transposition as one edit) so that a swapped-letter
 * typo such as "Jonhson" for "Johnson" scores 0.93 and is Suggested, as the
 * acceptance checklist requires; with plain Levenshtein it scores 0.87 and would
 * be Not found. See docs/DECISIONS.md.
 */
export function editDistance(x: string, y: string): number {
  const m = x.length;
  const n = y.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

export function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  const m = x.length;
  const n = y.length;
  if (!m && !n) return 1;
  return 1 - editDistance(x, y) / Math.max(m, n);
}

export const SUGGEST_THRESHOLD = 0.9;
