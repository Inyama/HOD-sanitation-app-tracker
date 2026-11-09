/**
 * Prettier on staged files. Large commits are split into batches so the command line stays
 * under the Windows limit (lint-staged no longer chunks long file lists itself).
 */
const BATCH = 40;

const batches = (files) => {
  const out = [];
  for (let i = 0; i < files.length; i += BATCH) out.push(files.slice(i, i + BATCH));
  return out;
};

const config = {
  "*.{ts,tsx,js,mjs,css,json,md}": (files) =>
    batches(files).map((b) => `prettier --write --ignore-unknown ${b.map((f) => JSON.stringify(f)).join(" ")}`),
};

export default config;
