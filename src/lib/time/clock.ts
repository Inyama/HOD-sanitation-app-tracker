import { DateTime } from "luxon";
import { MEETING_ZONE, toUtc, type DateInput } from "./zone";

/**
 * The single source of "now" for the whole app (spec section 5).
 * Never call Date.now() or new Date() for business logic: call now().
 *
 * Modes
 * - real:      wall-clock time.
 * - simulated: time starts at a chosen instant and keeps ticking (demo "Simulate time").
 * - frozen:    time stands still at a chosen instant (tests).
 */

type Mode =
  { kind: "real" } | { kind: "simulated"; anchorMs: number; realAnchorMs: number } | { kind: "frozen"; atMs: number };

let mode: Mode = { kind: "real" };
const listeners = new Set<() => void>();

function realMs(): number {
  return Date.now();
}

export function nowMs(): number {
  switch (mode.kind) {
    case "real":
      return realMs();
    case "simulated":
      return mode.anchorMs + (realMs() - mode.realAnchorMs);
    case "frozen":
      return mode.atMs;
  }
}

/** Current instant as a UTC Luxon DateTime. */
export function now(): DateTime {
  return DateTime.fromMillis(nowMs(), { zone: "utc" });
}

export function nowInLagos(): DateTime {
  return now().setZone(MEETING_ZONE);
}

/** Jump to an instant and keep ticking from there. */
export function simulateTime(at: DateInput): void {
  mode = { kind: "simulated", anchorMs: toUtc(at).toMillis(), realAnchorMs: realMs() };
  emit();
}

/** Stop the clock at an instant (used by tests and screenshots). */
export function freezeTime(at: DateInput): void {
  mode = { kind: "frozen", atMs: toUtc(at).toMillis() };
  emit();
}

/** Return to real wall-clock time. */
export function resetClock(): void {
  mode = { kind: "real" };
  emit();
}

export function clockMode(): Mode["kind"] {
  return mode.kind;
}

export function subscribeClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const l of listeners) l();
}
