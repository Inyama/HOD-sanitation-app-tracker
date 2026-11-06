"use client";

import { useState } from "react";

const KEY = "hod.deviceId";

function make(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A random id for this browser, sent with check-ins so the server can spot one phone checking
 * in several accounts (spec 6.2). Kept in localStorage; a fresh one is used if storage is blocked.
 */
export function useDeviceId(): string {
  const [id] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && /^[a-f0-9]{32}$/.test(saved)) return saved;
      const fresh = make();
      window.localStorage.setItem(KEY, fresh);
      return fresh;
    } catch {
      return make();
    }
  });
  return id;
}
