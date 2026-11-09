import "server-only";
import path from "node:path";
import { readFileSync } from "node:fs";
import { DateTime } from "luxon";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { MemberReport } from "./member-report";
import { methodLabel } from "./member-report";
import { MEETING_ZONE } from "@/lib/time/zone";

/** PDF statement for one member (spec 7.2 "My report"): logo, percentages and the meeting list. */

const NAVY = "#0a1a44";
const GOLD = "#d4a437";
const INK = "#0f172a";
const SLATE = "#475569";
const MIST = "#e2e8f0";
const STATUS: Record<string, { label: string; color: string }> = {
  ON_TIME: { label: "On time", color: "#14532d" },
  LATE: { label: "Late", color: "#78350f" },
  ABSENT: { label: "Absent", color: "#881337" },
  EXCUSED: { label: "Excused", color: "#1e3a8a" },
};

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 48, paddingHorizontal: 0, fontSize: 10, fontFamily: "Helvetica", color: INK },
  header: {
    backgroundColor: NAVY,
    paddingVertical: 18,
    paddingHorizontal: 36,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: { width: 30, height: 27 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 11, color: NAVY, marginLeft: 6 },
  headerRight: { marginLeft: "auto", color: "#ffffff", textAlign: "right" },
  goldBar: { height: 4, backgroundColor: GOLD },
  body: { paddingHorizontal: 36, paddingTop: 22 },
  h1: { fontFamily: "Times-Bold", fontSize: 22, color: INK },
  sub: { color: SLATE, marginTop: 4 },
  tiles: { flexDirection: "row", marginTop: 18, marginBottom: 6 },
  tile: { flex: 1, borderWidth: 1, borderColor: MIST, borderRadius: 8, padding: 10, marginRight: 8 },
  tileLabel: { color: SLATE, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.6 },
  tileValue: { fontFamily: "Helvetica-Bold", fontSize: 18, marginTop: 4 },
  tileNote: { color: SLATE, fontSize: 8, marginTop: 2 },
  h2: { fontFamily: "Times-Bold", fontSize: 14, marginTop: 18, marginBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: MIST, paddingVertical: 5 },
  th: { fontFamily: "Helvetica-Bold", color: SLATE, fontSize: 8, textTransform: "uppercase" },
  c1: { width: "24%" },
  c2: { width: "32%" },
  c3: { width: "15%" },
  c4: { width: "13%" },
  c5: { width: "16%" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", color: SLATE, fontSize: 8 },
});

const pct = (v: number | null) => (v === null ? "–" : `${v.toFixed(1).replace(/\.0$/, "")}%`);

function StatementDoc({ r, logo }: { r: MemberReport; logo: { data: Buffer; format: "png" } }) {
  const generated = DateTime.fromISO(r.generatedAt).setZone(MEETING_ZONE).toFormat("d LLL yyyy, h:mm a");
  const c = r.overall.counts;
  return (
    <Document title={`Attendance statement: ${r.person.name}`} author="HOD Sanitation Hub" subject={r.period.label}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View style={s.pill}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            <Image src={logo} style={s.logo} />
            <Text style={s.brand}>HOD Sanitation Hub</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Attendance statement</Text>
            <Text style={{ fontSize: 8, marginTop: 2 }}>Household of David · Sanitation Unit</Text>
          </View>
        </View>
        <View style={s.goldBar} fixed />
        <View style={s.body}>
          <Text style={s.h1}>{r.person.name}</Text>
          <Text style={s.sub}>
            {r.person.email} · {r.period.label}
          </Text>

          <View style={s.tiles}>
            <View style={s.tile}>
              <Text style={s.tileLabel}>Attendance</Text>
              <Text style={s.tileValue}>{pct(r.overall.percent)}</Text>
              <Text style={s.tileNote}>{r.overall.band.label}</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.tileLabel}>On-time rate</Text>
              <Text style={s.tileValue}>{pct(r.overall.onTimeRate)}</Text>
              <Text style={s.tileNote}>of meetings attended</Text>
            </View>
            <View style={s.tile}>
              <Text style={s.tileLabel}>Saturday</Text>
              <Text style={s.tileValue}>{pct(r.saturday.percent)}</Text>
              <Text style={s.tileNote}>Sanitation meetings</Text>
            </View>
            <View style={[s.tile, { marginRight: 0 }]}>
              <Text style={s.tileLabel}>Thursday</Text>
              <Text style={s.tileValue}>{pct(r.thursday.percent)}</Text>
              <Text style={s.tileNote}>Prayer meetings</Text>
            </View>
          </View>
          <Text style={s.sub}>
            {c.onTime} on time · {c.late} late · {c.absent} absent · {c.excused} excused · current streak{" "}
            {r.currentStreak} · longest streak in period {r.longestStreak}
          </Text>
          <Text style={[s.sub, { fontSize: 8 }]}>
            Attendance = (on time + late) ÷ (on time + late + absent). Excused meetings are not counted. Cancelled
            meetings and meetings before you joined are left out.
          </Text>

          <Text style={s.h2}>Meetings</Text>
          <View style={s.tr} fixed>
            <Text style={[s.th, s.c1]}>Date</Text>
            <Text style={[s.th, s.c2]}>Meeting</Text>
            <Text style={[s.th, s.c3]}>Status</Text>
            <Text style={[s.th, s.c4]}>Time</Text>
            <Text style={[s.th, s.c5]}>Recorded by</Text>
          </View>
          {r.rows.length === 0 ? (
            <Text style={[s.sub, { marginTop: 8 }]}>No meetings counted in this period.</Text>
          ) : (
            r.rows.map((row) => (
              <View key={row.meetingId} style={s.tr} wrap={false}>
                <Text style={s.c1}>{row.dateLabel}</Text>
                <Text style={s.c2}>{row.meeting}</Text>
                <Text style={[s.c3, { color: STATUS[row.status].color, fontFamily: "Helvetica-Bold" }]}>
                  {STATUS[row.status].label}
                </Text>
                <Text style={s.c4}>{row.checkInTime ?? "–"}</Text>
                <Text style={s.c5}>{methodLabel(row.method)}</Text>
              </View>
            ))
          )}
        </View>
        <View style={s.footer} fixed>
          <Text>Generated {generated} (Lagos time) · 7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos</Text>
          <Text
            style={{ marginLeft: "auto" }}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

let cachedLogo: { data: Buffer; format: "png" } | null = null;

/** The logo as bytes, so the renderer never tries to fetch it over the network. */
export function logoImage(): { data: Buffer; format: "png" } {
  if (!cachedLogo)
    cachedLogo = { data: readFileSync(path.join(process.cwd(), "public", "images", "HOD-logo.png")), format: "png" };
  return cachedLogo;
}

export async function renderMemberReportPdf(report: MemberReport): Promise<Buffer> {
  return renderToBuffer(<StatementDoc r={report} logo={logoImage()} />);
}

// ---------------------------------------------------------------------------
// Yearly service certificate (spec 7.3)
// ---------------------------------------------------------------------------

export interface CertificateData {
  name: string;
  year: number;
  hours: number;
  meetings: number;
  issuedOn: string;
}

const cs = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", color: INK },
  frame: { margin: 28, flexGrow: 1, borderWidth: 3, borderColor: GOLD, padding: 40, alignItems: "center" },
  inner: { flexGrow: 1, width: "100%", borderWidth: 1, borderColor: NAVY, padding: 36, alignItems: "center" },
  logo: { width: 84, height: 77, marginBottom: 12 },
  kicker: { fontSize: 10, letterSpacing: 3, color: SLATE, textTransform: "uppercase" },
  title: { fontFamily: "Times-Bold", fontSize: 34, color: NAVY, marginTop: 8 },
  presented: { marginTop: 22, fontSize: 12, color: SLATE },
  name: { fontFamily: "Times-Bold", fontSize: 30, marginTop: 8, color: INK },
  rule: { width: 260, height: 2, backgroundColor: GOLD, marginTop: 6 },
  body: { marginTop: 18, fontSize: 12.5, textAlign: "center", lineHeight: 1.5, maxWidth: 520 },
  hours: { fontFamily: "Helvetica-Bold", fontSize: 40, color: NAVY, marginTop: 14 },
  hoursLabel: { fontSize: 10, color: SLATE, textTransform: "uppercase", letterSpacing: 2 },
  footer: { flexDirection: "row", marginTop: "auto", width: "100%", justifyContent: "space-between", paddingTop: 30 },
  sig: {
    width: 200,
    borderTopWidth: 1,
    borderTopColor: SLATE,
    paddingTop: 4,
    fontSize: 9,
    color: SLATE,
    textAlign: "center",
  },
});

function CertificateDoc({ c, logo }: { c: CertificateData; logo: { data: Buffer; format: "png" } }) {
  return (
    <Document title={`Certificate of service ${c.year}: ${c.name}`} author="HOD Sanitation Hub">
      <Page size="A4" orientation="landscape" style={cs.page}>
        <View style={cs.frame}>
          <View style={cs.inner}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            <Image src={logo} style={cs.logo} />
            <Text style={cs.kicker}>Household of David · Sanitation Unit</Text>
            <Text style={cs.title}>Certificate of Service</Text>
            <Text style={cs.presented}>This certificate is presented to</Text>
            <Text style={cs.name}>{c.name}</Text>
            <View style={cs.rule} />
            <Text style={cs.body}>
              in grateful recognition of faithful service as a volunteer of the Sanitation Unit during {c.year}, serving
              God with excellence, one clean space at a time.
            </Text>
            <Text style={cs.hours}>{c.hours.toLocaleString("en-GB", { maximumFractionDigits: 1 })}</Text>
            <Text style={cs.hoursLabel}>verified service hours · {c.meetings} meetings served</Text>
            <View style={cs.footer}>
              <Text style={cs.sig}>Unit Lead</Text>
              <Text style={[cs.sig, { borderTopWidth: 0 }]}>Issued {c.issuedOn}</Text>
              <Text style={cs.sig}>Pastor in charge</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(c: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDoc c={c} logo={logoImage()} />);
}
