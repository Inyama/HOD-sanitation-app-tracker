import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import type { Meeting, User } from "@/lib/repo/types";
import { autoHoursFor } from "./hours";

/** Automatic service hours for a volunteer's attended Saturday or event (one entry per meeting). */
export async function grantAutoHours(repo: Repository, user: User, meeting: Meeting, at: DateTime): Promise<void> {
  if (user.role !== "VOLUNTEER" || meeting.type === "THURSDAY_PRAYER") return;
  if (await repo.serviceHours.findFirst({ userId: user.id, meetingId: meeting.id })) return;
  await repo.serviceHours.create({
    userId: user.id,
    meetingId: meeting.id,
    hours: autoHoursFor(meeting),
    source: "AUTO",
    verifiedById: null,
    createdAt: at.toISO()!,
    note: null,
  });
}
