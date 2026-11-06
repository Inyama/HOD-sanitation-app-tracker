import type { AudienceSpec, Role, UserStatus } from "@/lib/repo/types";
import type { BandKey } from "@/lib/attendance/percentage";

/** Who a message reaches (spec 7.4 Messaging center). Only active people receive messages. */

export interface AudiencePerson {
  id: string;
  role: Role;
  status: UserStatus;
  teamIds: string[];
  band: BandKey;
  absentLastSaturday: boolean;
}

export function resolveAudience(spec: AudienceSpec, people: AudiencePerson[]): string[] {
  const active = people.filter((p) => p.status === "ACTIVE");
  const pick = (f: (p: AudiencePerson) => boolean) => active.filter(f).map((p) => p.id);
  switch (spec.kind) {
    case "EVERYONE":
      return pick(() => true);
    case "ALL_MEMBERS":
      return pick((p) => p.role === "MEMBER");
    case "ALL_VOLUNTEERS":
      return pick((p) => p.role === "VOLUNTEER");
    case "TEAM":
      return pick((p) => p.teamIds.includes(spec.teamId));
    case "BAND":
      return pick((p) => p.band === spec.band);
    case "ABSENT_LAST_SATURDAY":
      return pick((p) => p.absentLastSaturday);
    case "HAND_PICKED": {
      const ids = new Set(spec.userIds);
      return pick((p) => ids.has(p.id));
    }
  }
}

export function describeAudience(spec: AudienceSpec, teamName?: (id: string) => string): string {
  switch (spec.kind) {
    case "EVERYONE":
      return "Everyone";
    case "ALL_MEMBERS":
      return "All members";
    case "ALL_VOLUNTEERS":
      return "All volunteers";
    case "TEAM":
      return `Team: ${teamName ? teamName(spec.teamId) : spec.teamId}`;
    case "BAND":
      return `Band: ${{ gold: "Gold standard", green: "Strong", amber: "Needs attention", red: "At risk" }[spec.band]}`;
    case "ABSENT_LAST_SATURDAY":
      return "Absent last Saturday";
    case "HAND_PICKED":
      return `${spec.userIds.length} hand-picked`;
  }
}
