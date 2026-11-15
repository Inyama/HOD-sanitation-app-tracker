/**
 * Escalation rule (spec 7.4 item 11): after N absences in a row, tell the person's Team Lead.
 * Pure: given each absent person's absences in a row and their team leads, who to tell.
 */

export interface EscalationInput {
  userId: string;
  name: string;
  absencesInARow: number;
  /** Leads of the teams the person belongs to (never the person themself). */
  leadIds: string[];
}

export interface Escalation {
  leadId: string;
  userId: string;
  name: string;
  absences: number;
  key: string;
}

export function escalations(meetingId: string, people: EscalationInput[], threshold: number): Escalation[] {
  const out: Escalation[] = [];
  for (const p of people) {
    if (p.absencesInARow < threshold) continue;
    for (const lead of new Set(p.leadIds)) {
      if (lead === p.userId) continue;
      out.push({
        leadId: lead,
        userId: p.userId,
        name: p.name,
        absences: p.absencesInARow,
        key: `${lead}:${meetingId}:ESCALATION:${p.userId}`,
      });
    }
  }
  return out;
}
