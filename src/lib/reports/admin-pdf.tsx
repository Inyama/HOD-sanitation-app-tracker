import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Report, ReportTable } from "./admin-reports";
import { logoImage } from "./pdf";

/** Branded PDF for any admin report (spec 7.4 item 8): navy header with the logo, summary tiles, tables. */

const NAVY = "#0a1a44";
const GOLD = "#d4a437";
const INK = "#0f172a";
const SLATE = "#475569";
const MIST = "#e2e8f0";
const ZEBRA = "#f8fafc";

const s = StyleSheet.create({
  page: { paddingBottom: 44, fontSize: 9, fontFamily: "Helvetica", color: INK },
  header: {
    backgroundColor: NAVY,
    paddingVertical: 14,
    paddingHorizontal: 30,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 3,
    paddingLeft: 5,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: { width: 26, height: 23 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 10, color: NAVY, marginLeft: 5 },
  headerRight: { marginLeft: "auto", color: "#ffffff", textAlign: "right" },
  goldBar: { height: 3, backgroundColor: GOLD },
  body: { paddingHorizontal: 30, paddingTop: 16 },
  h1: { fontFamily: "Times-Bold", fontSize: 20 },
  sub: { color: SLATE, marginTop: 3 },
  tiles: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  tile: {
    width: "24%",
    borderWidth: 1,
    borderColor: MIST,
    borderRadius: 6,
    padding: 7,
    marginRight: "1%",
    marginBottom: 6,
  },
  tileLabel: { color: SLATE, fontSize: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  tileValue: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 3 },
  h2: { fontFamily: "Times-Bold", fontSize: 13, marginTop: 14, marginBottom: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: MIST, paddingVertical: 3.5 },
  th: { fontFamily: "Helvetica-Bold", color: SLATE, fontSize: 7, textTransform: "uppercase" },
  note: { color: SLATE, fontSize: 8, marginTop: 4 },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", color: SLATE, fontSize: 7 },
});

function TableBlock({ t, dense }: { t: ReportTable; dense: boolean }) {
  const cols = t.pdfColumns ? t.columns.filter((c) => t.pdfColumns!.includes(c.key)) : t.columns;
  const total = cols.reduce((sum, c) => sum + (c.width ?? 1), 0);
  const w = (c: (typeof cols)[number]) => `${((c.width ?? 1) / total) * 100}%`;
  const size = dense ? 6.5 : 8.5;
  return (
    <View>
      <Text style={s.h2}>{t.title}</Text>
      <View style={s.tr} fixed>
        {cols.map((c) => (
          <Text key={c.key} style={[s.th, { width: w(c), textAlign: c.align ?? "left", paddingRight: 3 }]}>
            {c.header}
          </Text>
        ))}
      </View>
      {t.rows.length === 0 ? (
        <Text style={s.note}>{t.note ?? "Nothing to show for this period."}</Text>
      ) : (
        t.rows.map((r, i) => (
          <View key={i} style={[s.tr, i % 2 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
            {cols.map((c) => (
              <Text key={c.key} style={{ width: w(c), textAlign: c.align ?? "left", fontSize: size, paddingRight: 3 }}>
                {r[c.key] === null || r[c.key] === undefined ? "" : String(r[c.key])}
              </Text>
            ))}
          </View>
        ))
      )}
      {t.rows.length > 0 && t.note && <Text style={s.note}>{t.note}</Text>}
    </View>
  );
}

function ReportDoc({ r }: { r: Report }) {
  const logo = logoImage();
  const dense = r.tables.some((t) => (t.pdfColumns?.length ?? t.columns.length) > 12);
  return (
    <Document title={`${r.title}: ${r.period}`} author="HOD Sanitation Hub" subject={r.title}>
      <Page size="A4" orientation={r.landscape ? "landscape" : "portrait"} style={s.page}>
        <View style={s.header} fixed>
          <View style={s.pill}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            <Image src={logo} style={s.logo} />
            <Text style={s.brand}>HOD Sanitation Hub</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{r.title}</Text>
            <Text style={{ fontSize: 7, marginTop: 2 }}>Household of David · Sanitation Unit</Text>
          </View>
        </View>
        <View style={s.goldBar} fixed />
        <View style={s.body}>
          <Text style={s.h1}>{r.title}</Text>
          <Text style={s.sub}>{r.period}</Text>
          {r.filters.length > 0 && <Text style={s.sub}>{r.filters.join(" · ")}</Text>}
          <View style={s.tiles}>
            {r.summary.map(([k, v]) => (
              <View key={k} style={[s.tile, k === "Key" ? { width: "49%" } : {}]}>
                <Text style={s.tileLabel}>{k}</Text>
                <Text style={[s.tileValue, k === "Key" ? { fontSize: 8, fontFamily: "Helvetica" } : {}]}>{v}</Text>
              </View>
            ))}
          </View>
          {r.tables.map((t) => (
            <TableBlock key={t.title} t={t} dense={dense} />
          ))}
        </View>
        <View style={s.footer} fixed>
          <Text>Generated {r.generatedAt} (Lagos time) from live attendance records</Text>
          <Text
            style={{ marginLeft: "auto" }}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(report: Report): Promise<Buffer> {
  return renderToBuffer(<ReportDoc r={report} />);
}
