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

export type ClockState =
  { kind: "real" } | { kind: "simulated"; anchorMs: number; realAnchorMs: number } | { kind: "frozen"; atMs: number };
type Mode = ClockState;

let mode: Mode = { kind: "real" };
const listeners = new Set<() => void>();

function realMs(): number {
  return Date.now();
}

/** "Now" for a given clock state and real time (pure; also used by the server for demo clocks). */
export function nowFromState(state: ClockState, real: number): number {
  switch (state.kind) {
    case "real":
      return real;
    case "simulated":
      return state.anchorMs + (real - state.realAnchorMs);
    case "frozen":
      return state.atMs;
  }
}

export function nowMs(): number {
  return nowFromState(mode, realMs());
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

export function clockState(): ClockState {
  return mode;
}

/** Restore a saved state (e.g. from the demo clock cookie after a page load). */
export function restoreClock(state: ClockState): void {
  mode = state;
  emit();
}

/**
 * Demo mode only: the browser saves a simulated clock in this cookie so the server evaluates
 * check-in windows at the same simulated moment (spec 10.5). Ignored when demo mode is off.
 */
export const CLOCK_COOKIE = "hod_clock";

export function encodeClockState(state: ClockState): string {
  return encodeURIComponent(JSON.stringify(state));
}

export function decodeClockState(raw: string | undefined | null): ClockState | null {
  if (!raw || raw.length > 300) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as ClockState;
    const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
    if (v.kind === "real") return v;
    if (v.kind === "simulated" && finite(v.anchorMs) && finite(v.realAnchorMs)) return v;
    if (v.kind === "frozen" && finite(v.atMs)) return v;
  } catch {
    /* ignore malformed cookies */
  }
  return null;
}
