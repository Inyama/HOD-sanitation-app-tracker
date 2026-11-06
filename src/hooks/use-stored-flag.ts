"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false; // storage blocked (private window, previews)
  }
}

/**
 * A per-viewer boolean kept in localStorage (e.g. a collapsed sidebar).
 * Server render and first paint use `false`; storage failures are ignored.
 */
export function useStoredFlag(key: string): [boolean, (next: boolean) => void] {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
