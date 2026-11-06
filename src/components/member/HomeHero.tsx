"use client";

import Link from "next/link";
import { DateTime } from "luxon";
import { CalendarPlus, Clock3, MapPin, TriangleAlert } from "lucide-react";
import { CountdownHero } from "@/components/brand/CountdownHero";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/attendance/StatusChip";
import { useNow } from "@/hooks/use-now";
import { checkInWindow, windowPhase } from "@/lib/attendance/status";
import { formatShort } from "@/lib/time/zone";
import type { PublicMeeting } from "@/lib/member/data";
import { lagosClock } from "@/lib/member/display";

interface Props {
  meeting: PublicMeeting | null;
  venueAddress: string;
  record: { status: "ON_TIME" | "LATE" | "ABSENT" | "EXCUSED"; checkedInAt: string | null } | null;
  isRemote: boolean;
}

/**
 * Home hero (spec 7.2): countdown to the next meeting with "Check in now", enabled only inside
 * the check-in window, plus the late warning after the start time if not yet checked in.
 */
export function HomeHero({ meeting, venueAddress, record, isRemote }: Props) {
  const now = useNow(1000);
  if (!meeting) {
    return (
      <div className="bg-grad-hero rounded-(--radius-xl) p-8 text-white shadow-lift">
        <p className="font-heading text-2xl font-semibold">No meetings scheduled</p>
        <p className="mt-1 text-white/80">New meetings appear here as soon as they are added.</p>
      </div>
    );
  }

  const geo = meeting.method !== "SHEET" && !(isRemote && meeting.type === "SATURDAY");
  const start = DateTime.fromISO(meeting.startsAt, { zone: "utc" });
  const rules = {
    graceMinutes: meeting.graceMinutes,
    openBeforeMinutes: meeting.openBeforeMin,
    closeAfterMinutes: meeting.closeAfterMin,
  };
  const phase = geo && now ? windowPhase(now, start, rules) : null;
  const win = checkInWindow(start, rules);
  const checkedIn = record?.status === "ON_TIME" || record?.status === "LATE";
  const open = phase === "OPEN_ON_TIME" || phase === "OPEN_LATE";

  let action: React.ReactNode;
  let hint: string | undefined;
  if (!geo) {
    action = (
      <Button asChild variant="glass" size="lg">
        <a href={`/api/v1/meetings/${meeting.id}/calendar.ics`}>
          <CalendarPlus aria-hidden /> Add to calendar
        </a>
      </Button>
    );
    hint =
      isRemote && meeting.type === "SATURDAY"
        ? "You are a Remote member: no check-in needed."
        : "Recorded from the attendee sheet. No check-in needed.";
  } else if (checkedIn) {
    action = (
      <span className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/95 px-3 py-1.5">
        <StatusChip
          status={record!.status as "ON_TIME" | "LATE"}
          label={`Checked in · ${record!.status === "ON_TIME" ? "On time" : "Late"} ${lagosClock(record!.checkedInAt) ?? ""}`}
        />
      </span>
    );
  } else if (open) {
    action = (
      <Button asChild variant="gold" size="lg">
        <Link href="/member/check-in">
          <MapPin aria-hidden /> Check in now
        </Link>
      </Button>
    );
    hint =
      phase === "OPEN_LATE"
        ? `Closes ${formatShort(win.closesAt).split(", ")[1]}`
        : `Arrive by ${formatShort(win.lateAfter).split(", ")[1]} to be On time`;
  } else {
    action = (
      <Button variant="gold" size="lg" disabled>
        <MapPin aria-hidden /> Check in now
      </Button>
    );
    hint =
      phase === "CLOSED"
        ? "Check-in for this meeting has closed."
        : `Opens ${win.opensAt.setZone("Africa/Lagos").toFormat("cccc h:mm a").replace("AM", "am").replace("PM", "pm")}`;
  }

  return (
    <div className="space-y-3">
      {phase === "OPEN_LATE" && !checkedIn && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-(--radius-md) border border-(--status-late)/50 bg-(--status-late-bg) p-4 text-(--status-late-fg)"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-semibold">The meeting has started.</span> You have not checked in yet; checking in now
            counts as Late. Check-in closes at {lagosClock(win.closesAt.toISO())}.
          </p>
        </div>
      )}
      <CountdownHero
        eyebrow={meeting.type === "SPECIAL" ? "Next event" : "Next meeting"}
        meetingName={meeting.status === "CANCELLED" ? `${meeting.title} (cancelled)` : meeting.title}
        startsAt={meeting.startsAt}
        venue={venueAddress}
        action={action}
        actionHint={hint}
      />
      {geo && phase === "BEFORE" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock3 aria-hidden className="size-4" /> Check-in window: {lagosClock(win.opensAt.toISO())} to{" "}
          {lagosClock(win.closesAt.toISO())} (Lagos).
        </p>
      )}
    </div>
  );
}
