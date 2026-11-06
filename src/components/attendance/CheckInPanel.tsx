"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import {
  CircleCheck,
  Clock3,
  Crosshair,
  Hand,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinOff,
  Navigation,
  RotateCcw,
  ShieldAlert,
  Sun,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "./StatusChip";
import { CheckInMap } from "./CheckInMap";
import { Confetti } from "./Confetti";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { CountdownTiles } from "@/components/brand/CountdownHero";
import { useNow } from "@/hooks/use-now";
import { useDeviceId } from "@/hooks/use-device-id";
import { checkInWindow, windowPhase } from "@/lib/attendance/status";
import { distanceMetres, evaluateLocation } from "@/lib/attendance/geofence";
import { LOCATION_PRESETS, simulatedReading, timePresets, type LocationPresetId } from "@/lib/demo/simulate";
import { resetClock, simulateTime } from "@/lib/time/clock";
import { directionsUrl } from "@/lib/venue";
import { formatShort } from "@/lib/time/zone";
import { lagosClock } from "@/lib/member/display";
import { apiRequest } from "@/lib/api-client";
import type { PublicMeeting } from "@/lib/member/data";
import { cn } from "@/lib/utils";

export interface CheckInPanelProps {
  meeting: PublicMeeting | null;
  venue: { name: string; address: string; lat: number; lng: number; radiusM: number };
  maxAccuracyM: number;
  existing: { status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED"; checkedInAt: string | null } | null;
  percent: number | null;
  isRemote: boolean;
  demo: boolean;
  initialCode?: string;
}

type Reading = { lat: number; lng: number; accuracyM: number };
type Step =
  | { kind: "ready" }
  | { kind: "locating"; accuracy: number | null }
  | { kind: "located"; reading: Reading }
  | { kind: "submitting"; reading: Reading }
  | {
      kind: "success";
      status: "ON_TIME" | "LATE";
      checkedInAt: string;
      percent: number | null;
      band: string;
      flagged: boolean;
      distanceM: number;
    }
  | { kind: "rejected"; code: string; message: string; reading: Reading | null; distanceM?: number }
  | { kind: "denied" }
  | { kind: "unavailable" };

const LOCATE_TIMEOUT_MS = 12_000;

function AccuracyMeter({ accuracy, max }: { accuracy: number | null; max: number }) {
  const quality = accuracy === null ? 0 : Math.max(0.05, Math.min(1, 1 - accuracy / (max * 2)));
  const label =
    accuracy === null ? "Waiting for GPS…" : accuracy <= max * 0.5 ? "Good" : accuracy <= max ? "Fair" : "Too weak";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium">GPS accuracy</span>
        <span className="tabular text-muted-foreground">
          {accuracy === null ? "–" : `±${Math.round(accuracy)} m`} · {label}
        </span>
      </div>
      <div
        role="meter"
        aria-label="GPS accuracy"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(quality * 100)}
        aria-valuetext={
          accuracy === null ? "Waiting for GPS" : `Plus or minus ${Math.round(accuracy)} metres, ${label}`
        }
        className="h-2.5 overflow-hidden rounded-full bg-mist"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            label === "Good" ? "bg-success" : label === "Fair" ? "bg-(--status-late)" : "bg-(--status-absent)",
          )}
          style={{ width: `${quality * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CheckInPanel({
  meeting,
  venue,
  maxAccuracyM,
  existing,
  percent,
  isRemote,
  demo,
  initialCode,
}: CheckInPanelProps) {
  const router = useRouter();
  const now = useNow(1000);
  const deviceId = useDeviceId();
  const [step, setStep] = React.useState<Step>({ kind: "ready" });
  const [locationSource, setLocationSource] = React.useState<"device" | LocationPresetId>(demo ? "AT_VENUE" : "device");
  const [code, setCode] = React.useState(initialCode ?? "");
  const [announce, setAnnounce] = React.useState("");
  const [presets] = React.useState(() => timePresets(DateTime.now()));
  const watchRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    },
    [],
  );

  if (!meeting) {
    return (
      <EmptyState
        illustration="calendar"
        title="No check-in meeting coming up"
        description="Saturday meetings and events appear here when check-in is due."
      />
    );
  }

  const start = DateTime.fromISO(meeting.startsAt, { zone: "utc" });
  const rules = {
    graceMinutes: meeting.graceMinutes,
    openBeforeMinutes: meeting.openBeforeMin,
    closeAfterMinutes: meeting.closeAfterMin,
  };
  const win = checkInWindow(start, rules);
  const phase = now ? windowPhase(now, start, rules) : null;
  const alreadyIn = existing?.status === "ON_TIME" || existing?.status === "LATE";

  const located = (reading: Reading) => {
    setStep({ kind: "located", reading });
    const v = evaluateLocation(reading, venue, maxAccuracyM);
    setAnnounce(
      v.ok
        ? `Located. You are ${Math.round(v.distanceM)} metres from the venue, inside the check-in area.`
        : v.reason === "LOW_ACCURACY"
          ? `Your GPS accuracy is ${Math.round(reading.accuracyM)} metres, which is too weak.`
          : `You are ${Math.round(v.distanceM)} metres from the venue, outside the check-in area.`,
    );
  };

  const locate = () => {
    setAnnounce("Finding your location…");
    if (locationSource !== "device") {
      setStep({ kind: "locating", accuracy: null });
      const reading = simulatedReading(locationSource, venue);
      window.setTimeout(() => {
        if (!reading) {
          setStep({ kind: "unavailable" });
          setAnnounce("GPS is unavailable.");
        } else {
          setStep({ kind: "locating", accuracy: reading.accuracyM });
          window.setTimeout(() => located(reading), 400);
        }
      }, 700);
      return;
    }
    if (!("geolocation" in navigator)) {
      setStep({ kind: "unavailable" });
      return;
    }
    setStep({ kind: "locating", accuracy: null });
    let best: Reading | null = null;
    const finish = () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      if (best) located(best);
      else setStep({ kind: "unavailable" });
    };
    const timer = window.setTimeout(finish, LOCATE_TIMEOUT_MS);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const r = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy };
        if (!best || r.accuracyM < best.accuracyM) best = r;
        setStep({ kind: "locating", accuracy: best.accuracyM });
        if (best.accuracyM <= maxAccuracyM * 0.6) {
          window.clearTimeout(timer);
          finish();
        }
      },
      (err) => {
        window.clearTimeout(timer);
        if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
        setStep(err.code === err.PERMISSION_DENIED ? { kind: "denied" } : { kind: "unavailable" });
        setAnnounce(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "GPS is unavailable.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: LOCATE_TIMEOUT_MS },
    );
  };

  const confirm = async (reading: Reading) => {
    setStep({ kind: "submitting", reading });
    const r = await apiRequest<{
      status: "ON_TIME" | "LATE";
      checkedInAt: string;
      percent: number | null;
      band: string;
      flagged: boolean;
      distanceM: number;
    }>(`/api/v1/meetings/${meeting.id}/check-in`, {
      body: {
        latitude: reading.lat,
        longitude: reading.lng,
        accuracy: reading.accuracyM,
        deviceId,
        ...(code ? { qrToken: code } : {}),
      },
    });
    if (!r.ok) {
      setStep({
        kind: "rejected",
        code: r.code,
        message: r.message,
        reading,
        distanceM: (r as unknown as { distanceM?: number }).distanceM,
      });
      setAnnounce(`Check-in not recorded. ${r.message}`);
      return;
    }
    setStep({
      kind: "success",
      status: r.status,
      checkedInAt: r.checkedInAt,
      percent: r.percent,
      band: r.band,
      flagged: r.flagged,
      distanceM: r.distanceM,
    });
    setAnnounce(`Checked in: ${r.status === "ON_TIME" ? "On time" : "Late"} at ${lagosClock(r.checkedInAt)}.`);
    router.refresh();
  };

  const jump = (at: string | null) => {
    if (at) simulateTime(at);
    else resetClock();
    setStep({ kind: "ready" });
    router.refresh();
  };

  const demoPanel = demo && (
    <GlassCard tone="accent" data-role="admin" className="space-y-4">
      <div className="flex items-center gap-2">
        <Wand2 aria-hidden className="size-5 text-role-strong" />
        <h2 className="text-base font-semibold">Demo: simulate time and location</h2>
      </div>
      <div role="group" aria-label="Simulate time" className="flex flex-wrap gap-2">
        {presets.slice(0, 4).map((p) => (
          <Button key={p.id} type="button" size="sm" variant="outline" onClick={() => jump(p.at)} title={p.description}>
            {p.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => jump(null)}>
          <RotateCcw aria-hidden /> Real time
        </Button>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Location</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { id: "device" as const, label: "This device's GPS", description: "Uses your real location" },
            ...LOCATION_PRESETS,
          ].map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-(--radius-sm) border px-3 py-2 text-sm",
                locationSource === p.id ? "border-role bg-surface" : "border-border bg-surface/60",
              )}
            >
              <input
                type="radio"
                name="loc"
                className="mt-1 accent-[var(--royal-600)]"
                checked={locationSource === p.id}
                onChange={() => setLocationSource(p.id)}
              />
              <span>
                <span className="block font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </GlassCard>
  );

  const header = (
    <GlassCard className="space-y-1">
      <p className="text-xs font-semibold tracking-[0.14em] text-role-strong uppercase">
        {meeting.type === "SPECIAL" ? "Event" : "Meeting"}
      </p>
      <h2 className="text-xl font-semibold">{meeting.title}</h2>
      <p className="text-sm text-muted-foreground">
        {formatShort(meeting.startsAt)} (Lagos) · check-in {lagosClock(win.opensAt.toISO())} to{" "}
        {lagosClock(win.closesAt.toISO())} · On time until {lagosClock(win.lateAfter.toISO())}
      </p>
      <p className="text-sm text-muted-foreground">{venue.address}</p>
    </GlassCard>
  );

  let body: React.ReactNode;
  if (isRemote && meeting.type === "SATURDAY") {
    body = (
      <EmptyState
        illustration="calendar"
        title="No check-in needed"
        description="You are a Remote member, so Saturday attendance is recorded by a leader, not by location."
      />
    );
  } else if (meeting.status === "CANCELLED") {
    body = (
      <EmptyState
        illustration="calendar"
        title="This meeting is cancelled"
        description={meeting.statusNote ?? "No check-in is needed."}
      />
    );
  } else if (step.kind === "success") {
    body = (
      <GlassCard className="relative overflow-visible text-center">
        <Confetti />
        <CircleCheck aria-hidden className="mx-auto size-12 text-success" />
        <h2 className="mt-2 text-2xl font-semibold">You are checked in</h2>
        <div className="mt-3 flex justify-center">
          <StatusChip
            status={step.status}
            label={`${step.status === "ON_TIME" ? "On time" : "Late"} · ${lagosClock(step.checkedInAt)}`}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{step.distanceM} m from the venue pin.</p>
        {step.flagged && (
          <p className="mx-auto mt-3 max-w-md rounded-(--radius-sm) bg-(--status-late-bg) p-2 text-sm text-(--status-late-fg)">
            Your check-in is saved and will be reviewed by an admin (for example, this device was used by another
            account).
          </p>
        )}
        <div className="mt-5 flex justify-center">
          <AttendanceRing percent={step.percent} label="Your attendance" size={150} />
        </div>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/member">Back to home</Link>
        </Button>
      </GlassCard>
    );
  } else if (alreadyIn) {
    body = (
      <GlassCard className="text-center">
        <CircleCheck aria-hidden className="mx-auto size-10 text-success" />
        <h2 className="mt-2 text-xl font-semibold">Already checked in</h2>
        <div className="mt-3 flex justify-center">
          <StatusChip
            status={existing!.status as "ON_TIME" | "LATE"}
            label={`${existing!.status === "ON_TIME" ? "On time" : "Late"} · ${lagosClock(existing!.checkedInAt) ?? ""}`}
          />
        </div>
        <div className="mt-4 flex justify-center">
          <AttendanceRing percent={percent} label="Your attendance" size={140} />
        </div>
      </GlassCard>
    );
  } else if (phase === "BEFORE") {
    body = (
      <GlassCard className="space-y-4">
        <div className="flex items-start gap-3">
          <Clock3 aria-hidden className="mt-0.5 size-6 shrink-0 text-role-strong" />
          <div>
            <h2 className="text-lg font-semibold">Check-in is not open yet</h2>
            <p className="text-muted-foreground">
              It opens{" "}
              {win.opensAt
                .setZone("Africa/Lagos")
                .toFormat("cccc d LLLL 'at' h:mm a")
                .replace("AM", "am")
                .replace("PM", "pm")}{" "}
              (Lagos), one hour before the start.
            </p>
          </div>
        </div>
        <div className="bg-grad-hero rounded-(--radius-md) p-4 text-white">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gold-300 uppercase">Opens in</p>
          <CountdownTiles startsAt={win.opensAt.toISO()!} />
        </div>
      </GlassCard>
    );
  } else if (phase === "CLOSED") {
    body = (
      <GlassCard className="flex items-start gap-3">
        <ShieldAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-(--status-late)" />
        <div>
          <h2 className="text-lg font-semibold">Check-in has closed</h2>
          <p className="text-muted-foreground">
            The window closed at {lagosClock(win.closesAt.toISO())}. If you were there, ask a Check-in Marshal or submit
            an excuse with details.
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/member/excuses">Request an excuse</Link>
          </Button>
        </div>
      </GlassCard>
    );
  } else {
    const reading =
      step.kind === "located" || step.kind === "submitting"
        ? step.reading
        : step.kind === "rejected"
          ? step.reading
          : null;
    const verdict = reading ? evaluateLocation(reading, venue, maxAccuracyM) : null;
    body = (
      <div className="space-y-4">
        {phase === "OPEN_LATE" && (
          <p
            role="note"
            className="flex items-start gap-2 rounded-(--radius-sm) border border-(--status-late)/50 bg-(--status-late-bg) p-3 text-sm text-(--status-late-fg)"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> The meeting started at{" "}
            {lagosClock(meeting.startsAt)}. Checking in now counts as Late.
          </p>
        )}
        <CheckInMap venue={{ ...venue }} me={reading} />
        {reading && verdict && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-(--radius-sm) border border-border p-3">
              <dt className="text-muted-foreground">Distance from venue</dt>
              <dd className="tabular text-lg font-semibold">{`${Math.round(distanceMetres(reading.lat, reading.lng, venue.lat, venue.lng)).toLocaleString("en-GB")} m`}</dd>
            </div>
            <div className="rounded-(--radius-sm) border border-border p-3">
              <dt className="text-muted-foreground">GPS accuracy</dt>
              <dd className="tabular text-lg font-semibold">±{Math.round(reading.accuracyM)} m</dd>
            </div>
          </dl>
        )}

        {step.kind === "ready" && (
          <GlassCard className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <LocateFixed aria-hidden className="size-5 text-role-strong" /> Ready to check in
            </h2>
            <p className="text-sm text-muted-foreground">
              We read your location once, only now, to confirm you are within {venue.radiusM} m of the venue. Your
              browser will ask for permission.
            </p>
            {meeting.requireQr && (
              <div className="space-y-1.5">
                <Label htmlFor="qr">Code from the marshal&apos;s screen</Label>
                <Input
                  id="qr"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  autoComplete="off"
                  className="tabular tracking-[0.3em] uppercase"
                />
              </div>
            )}
            <Button variant="role" size="lg" className="w-full sm:w-auto" onClick={locate}>
              <Crosshair aria-hidden /> Find my location
            </Button>
          </GlassCard>
        )}

        {step.kind === "locating" && (
          <GlassCard className="space-y-4" aria-busy="true">
            <p className="flex items-center gap-2 font-semibold">
              <Loader2 aria-hidden className="size-5 animate-spin text-role-strong" /> Locating you…
            </p>
            <AccuracyMeter accuracy={step.accuracy} max={maxAccuracyM} />
          </GlassCard>
        )}

        {(step.kind === "located" || step.kind === "submitting") && verdict && (
          <GlassCard className="space-y-3">
            {verdict.ok ? (
              <>
                <p className="flex items-start gap-2 font-semibold text-(--status-ontime-fg)">
                  <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" /> You are inside the check-in area.
                </p>
                <AccuracyMeter accuracy={step.reading.accuracyM} max={maxAccuracyM} />
                <Button
                  variant="gold"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={step.kind === "submitting"}
                  onClick={() => confirm(step.reading)}
                >
                  {step.kind === "submitting" ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : (
                    <CircleCheck aria-hidden />
                  )}{" "}
                  Confirm check-in
                </Button>
              </>
            ) : verdict.reason === "LOW_ACCURACY" ? (
              <>
                <p className="flex items-start gap-2 font-semibold text-(--status-late-fg)">
                  <Sun aria-hidden className="mt-0.5 size-5 shrink-0" /> Your GPS signal is too weak (±
                  {Math.round(step.reading.accuracyM)} m; we need ±{maxAccuracyM} m or better).
                </p>
                <p className="text-sm text-muted-foreground">
                  Move outdoors or near a window, wait a few seconds, then try again.
                </p>
                <AccuracyMeter accuracy={step.reading.accuracyM} max={maxAccuracyM} />
                <Button variant="role" onClick={locate}>
                  <RotateCcw aria-hidden /> Move outdoors and retry
                </Button>
              </>
            ) : (
              <>
                <p className="flex items-start gap-2 font-semibold text-(--status-absent-fg)">
                  <MapPinOff aria-hidden className="mt-0.5 size-5 shrink-0" /> You are{" "}
                  {Math.round(verdict.distanceM).toLocaleString("en-GB")} m from the venue, outside the {venue.radiusM}{" "}
                  m check-in area.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="role">
                    <a href={directionsUrl(venue.lat, venue.lng)} target="_blank" rel="noopener noreferrer">
                      <Navigation aria-hidden /> Get directions<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </Button>
                  <Button variant="outline" onClick={locate}>
                    <RotateCcw aria-hidden /> Try again
                  </Button>
                </div>
              </>
            )}
          </GlassCard>
        )}

        {step.kind === "rejected" && (
          <GlassCard className="space-y-3">
            <p role="alert" className="flex items-start gap-2 font-semibold text-(--status-absent-fg)">
              <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" /> {step.message}
              {step.distanceM !== undefined && ` (${step.distanceM.toLocaleString("en-GB")} m away)`}
            </p>
            <Button variant="outline" onClick={() => setStep({ kind: "ready" })}>
              <RotateCcw aria-hidden /> Start again
            </Button>
          </GlassCard>
        )}

        {step.kind === "denied" && (
          <GlassCard className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MapPinOff aria-hidden className="size-5 text-(--status-absent-fg)" /> Location permission is off
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Tap the lock or settings icon next to the web address.</li>
              <li>Set Location to Allow for this site.</li>
              <li>Come back here and press Find my location again.</li>
            </ol>
            <p className="text-sm text-muted-foreground">
              On iPhone: Settings, Privacy, Location Services, Safari Websites, While Using the App.
            </p>
            <Button variant="role" onClick={locate}>
              <RotateCcw aria-hidden /> Try again
            </Button>
          </GlassCard>
        )}

        {step.kind === "unavailable" && (
          <GlassCard className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MapPinOff aria-hidden className="size-5 text-(--status-late-fg)" /> We could not get your location
            </h2>
            <p className="text-sm text-muted-foreground">
              Your phone did not return a GPS position. Turn on location services and try again, or ask a Check-in
              Marshal to record you by hand.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="role" onClick={locate}>
                <RotateCcw aria-hidden /> Try again
              </Button>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 text-sm">
                <Hand aria-hidden className="size-4" /> Ask a marshal at the gate
              </span>
            </div>
          </GlassCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {header}
      {body}
      {demoPanel}
    </div>
  );
}
