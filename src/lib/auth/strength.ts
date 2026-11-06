/** Password rules and strength meter (spec 4.3: minimum 10 characters). Pure; used in forms and on the server. */

export const MIN_PASSWORD_LENGTH = 10;

export interface Strength {
  /** 0 (very weak) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  hints: string[];
}

const COMMON = [
  "password",
  "12345678",
  "qwerty",
  "letmein",
  "welcome",
  "iloveyou",
  "abc123",
  "admin",
  "hod",
  "sanitation",
  "church",
];

export function passwordStrength(pw: string): Strength {
  const hints: string[] = [];
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return { score: 0, label: "Too short", hints: [`Use at least ${MIN_PASSWORD_LENGTH} characters.`] };
  }
  let score = 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  if (pw.length >= 14) score++;
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) {
    score = Math.max(1, score - 2);
    hints.push("Avoid common words such as “password”.");
  }
  if (/(.)\1{3,}/.test(pw)) {
    score = Math.max(1, score - 1);
    hints.push("Avoid repeating the same character.");
  }
  if (classes < 3) hints.push("Mix upper and lower case letters, numbers and symbols.");
  if (pw.length < 14) hints.push("Longer is stronger: try 14 or more characters.");
  const s = Math.min(4, score) as Strength["score"];
  const label = (["Too short", "Weak", "Fair", "Good", "Strong"] as const)[s];
  return { score: s, label, hints };
}

export function isAcceptablePassword(pw: string): boolean {
  return pw.length >= MIN_PASSWORD_LENGTH && pw.length <= 128 && passwordStrength(pw).score >= 2;
}
