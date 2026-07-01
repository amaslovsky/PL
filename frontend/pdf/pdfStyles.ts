import { StyleSheet } from "@react-pdf/renderer";

// Letter-size page, 0.75" margins (54pt). Helvetica is the built-in default
// in @react-pdf/renderer, so no font registration is needed.
export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 54,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
    color: "#111",
  },
  h1: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 6,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 4,
  },
  body: {
    marginBottom: 6,
  },
  intro: {
    marginBottom: 10,
  },
  // Cover page "section" (h2 + body pair)
  section: {
    marginBottom: 8,
  },
  checkboxLine: {
    marginLeft: 12,
    marginBottom: 2,
  },
  // Signature table — one row of three flex views: label | party1 | party2.
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#999",
    paddingVertical: 4,
  },
  tableCellLabel: {
    width: 110,
    fontFamily: "Helvetica-Bold",
    paddingRight: 8,
  },
  tableCell: {
    flex: 1,
    paddingRight: 8,
  },
  // Standard terms section opener: paragraph title in bold followed by text
  paragraph: {
    marginBottom: 8,
  },
  paragraphTitle: {
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    marginTop: 16,
    fontSize: 9,
    color: "#555",
  },
});