import { createElement as h } from "react";
import { Document, Page, Text, View, renderToFile } from "@react-pdf/renderer";
const items = [
  "Wear comfortable clothes and closed shoes",
  "Bring gloves (spares at the Supplies desk)",
  "Check in on the app at the gate from 6:30 am",
  "Report to your Team Lead by 7:30 am",
  "Sanctuary: chairs out, vacuum, wipe pews",
  "Restrooms: descale, restock, mop",
  "Kitchen: degrease hob and extractor",
  "Outdoors: gutters, drains and car park",
  "Breakfast at 10:30 am in the fellowship hall",
];
const doc = h(
  Document,
  { title: "Deep Clean Day checklist" },
  h(
    Page,
    { size: "A4", style: { padding: 48, fontFamily: "Helvetica", fontSize: 12 } },
    h(Text, { style: { fontFamily: "Times-Bold", fontSize: 22, marginBottom: 6 } }, "Deep Clean Day checklist"),
    h(
      Text,
      { style: { color: "#475569", marginBottom: 18 } },
      "Saturday 28 November 2026 · 7:30 am · Household of David, Ikeja",
    ),
    h(View, null, ...items.map((t, i) => h(Text, { key: i, style: { marginBottom: 8 } }, `[  ]  ${t}`))),
  ),
);
renderToFile(doc, "public/files/deep-clean-checklist.pdf").then(() => console.log("ok"));
