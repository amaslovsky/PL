"use client";

import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { NdaFormData } from "@/types/nda";
import { confidentialityTermPhrase, ndaTermPhrase } from "@/utils/terms";
import { pdfStyles } from "./pdfStyles";

interface NdaPdfDocumentProps {
  data: NdaFormData;
}

/**
 * Two-page PDF document: cover page on page 1, standard terms on page 2.
 *
 * The PDF is built directly from `data` (typed form values). The
 * standard-terms prose is inlined as the `PARAGRAPHS` array below — a
 * single source of truth for the PDF rendering of the MNDA standard
 * terms. The on-screen preview uses the markdown at
 * `templates/mutual-nda.md` (with cross-references substituted by
 * `lib/fillTemplate.ts`), so a future task to consolidate these two
 * renderers can do so without breaking either consumer.
 */
export function NdaPdfDocument({ data }: NdaPdfDocumentProps) {
  return (
    <Document title="Mutual NDA" author="Prelegal">
      <CoverPage data={data} />
      <StandardTermsPage data={data} />
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

function CoverPage({ data }: { data: NdaFormData }) {
  return (
    <Page size="LETTER" style={pdfStyles.page}>
      <Text style={pdfStyles.h1}>Mutual Non-Disclosure Agreement</Text>

      <Text style={pdfStyles.h2}>Using this Mutual Non-Disclosure Agreement</Text>
      <Text style={pdfStyles.intro}>
        This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this
        Cover Page (“Cover Page”) and (2) the Common Paper Mutual NDA Standard
        Terms Version 1.0 (“Standard Terms”). Any modifications of the Standard
        Terms should be made on the Cover Page, which will control over
        conflicts with the Standard Terms.
      </Text>

      <Section title="Purpose" body={data.purpose} />
      <Section title="Effective Date" body={data.effectiveDateDisplay} />

      <Text style={pdfStyles.h2}>MNDA Term</Text>
      <Checkbox checked={data.ndaTerm.mode === "expires"}>
        Expires {data.ndaTerm.years} year(s) from Effective Date.
      </Checkbox>
      <Checkbox checked={data.ndaTerm.mode === "continues"}>
        Continues until terminated in accordance with the terms of the MNDA.
      </Checkbox>

      <Text style={pdfStyles.h2}>Term of Confidentiality</Text>
      <Checkbox checked={data.confidentialityTerm.mode === "years"}>
        {data.confidentialityTerm.years} year(s) from Effective Date, but in
        the case of trade secrets until Confidential Information is no longer
        considered a trade secret under applicable laws.
      </Checkbox>
      <Checkbox checked={data.confidentialityTerm.mode === "perpetuity"}>
        In perpetuity.
      </Checkbox>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.h2}>Governing Law &amp; Jurisdiction</Text>
        <Text style={pdfStyles.body}>Governing Law: {data.governingLaw}</Text>
        <Text style={pdfStyles.body}>Jurisdiction: {data.jurisdiction}</Text>
      </View>

      <Text style={pdfStyles.h2}>MNDA Modifications</Text>
      <Text style={pdfStyles.body}>List any modifications to the MNDA</Text>

      <Text style={[pdfStyles.body, { marginTop: 12 }]}>
        By signing this Cover Page, each party agrees to enter into this MNDA
        as of the Effective Date.
      </Text>

      <SignatureTable />

      <Text style={pdfStyles.footer}>
        Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use
        under CC BY 4.0.
      </Text>
    </Page>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.h2}>{title}</Text>
      <Text style={pdfStyles.body}>{body}</Text>
    </View>
  );
}

function Checkbox({ checked, children }: { checked: boolean; children: React.ReactNode }) {
  return (
    <Text style={pdfStyles.checkboxLine}>
      [{checked ? "x" : " "}] {children}
    </Text>
  );
}

function SignatureTable() {
  const rowLabels = ["Signature", "Print Name", "Title", "Company", "Notice Address", "Date"];
  return (
    <View style={{ marginTop: 12 }}>
      <View style={pdfStyles.tableRow}>
        <View style={pdfStyles.tableCellLabel}><Text></Text></View>
        <View style={pdfStyles.tableCell}><Text style={pdfStyles.paragraphTitle}>Party 1</Text></View>
        <View style={pdfStyles.tableCell}><Text style={pdfStyles.paragraphTitle}>Party 2</Text></View>
      </View>
      {rowLabels.map((label) => (
        <View key={label} style={pdfStyles.tableRow}>
          <View style={pdfStyles.tableCellLabel}>
            <Text>{label}</Text>
          </View>
          <View style={pdfStyles.tableCell}><Text></Text></View>
          <View style={pdfStyles.tableCell}><Text></Text></View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Standard terms — number-keyed text blocks. All verbatim from the
// Common Paper Mutual NDA Standard Terms v1.0 (cross-references filled
// from `data` so the resulting document is self-contained).
// ---------------------------------------------------------------------------

interface Paragraph {
  number: string;
  title: string;
  body: (data: NdaFormData) => string;
}

const PARAGRAPHS: Paragraph[] = [
  {
    number: "1",
    title: "Introduction",
    body: (d) =>
      `This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page (defined below)) (“MNDA”) allows each party (“Disclosing Party”) to disclose or make available information in connection with the ${d.purpose} which (1) the Disclosing Party identifies to the receiving party (“Receiving Party”) as “confidential”, “proprietary”, or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure (“Confidential Information”). Each party’s Confidential Information also includes the existence and status of the parties’ discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how. To use this MNDA, the parties must complete and sign a cover page incorporating these Standard Terms (“Cover Page”). Each party is identified on the Cover Page and capitalized terms have the meanings given herein or on the Cover Page.`,
  },
  {
    number: "2",
    title: "Use and Protection of Confidential Information",
    body: (d) =>
      `The Receiving Party shall: (a) use Confidential Information solely for the ${d.purpose}; (b) not disclose Confidential Information to third parties without the Disclosing Party’s prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the ${d.purpose}, provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care.`,
  },
  {
    number: "3",
    title: "Exceptions",
    body: () =>
      `The Receiving Party’s obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information.`,
  },
  {
    number: "4",
    title: "Disclosures Required by Law",
    body: () =>
      `The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party’s expense, with the Disclosing Party’s efforts to obtain confidential treatment for the Confidential Information.`,
  },
  {
    number: "5",
    title: "Term and Termination",
    body: (d) =>
      `This MNDA commences on the ${d.effectiveDateDisplay} and expires at the end of the ${ndaTermPhrase(d)}. Either party may terminate this MNDA for any or no reason upon written notice to the other party. The Receiving Party’s obligations relating to Confidential Information will survive for the ${confidentialityTermPhrase(d)}, despite any expiration or termination of this MNDA.`,
  },
  {
    number: "6",
    title: "Return or Destruction of Confidential Information",
    body: () =>
      `Upon expiration or termination of this MNDA or upon the Disclosing Party’s earlier request, the Receiving Party will: (a) cease using Confidential Information; (b) promptly after the Disclosing Party’s written request, destroy all Confidential Information in the Receiving Party’s possession or control or return it to the Disclosing Party; and (c) if requested by the Disclosing Party, confirm its compliance with these obligations in writing. As an exception to subsection (b), the Receiving Party may retain Confidential Information in accordance with its standard backup or record retention policies or as required by law, but the terms of this MNDA will continue to apply to the retained Confidential Information.`,
  },
  {
    number: "7",
    title: "Proprietary Rights",
    body: () =>
      `The Disclosing Party retains all of its intellectual property and other rights in its Confidential Information and its disclosure to the Receiving Party grants no license under such rights.`,
  },
  {
    number: "8",
    title: "Disclaimer",
    body: () =>
      `ALL CONFIDENTIAL INFORMATION IS PROVIDED “AS IS”, WITH ALL FAULTS, AND WITHOUT WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.`,
  },
  {
    number: "9",
    title: "Governing Law and Jurisdiction",
    body: (d) =>
      `This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the State of ${d.governingLaw}, without regard to the conflict of laws provisions of such ${d.governingLaw}. Any legal suit, action, or proceeding relating to this MNDA must be instituted in the federal or state courts located in ${d.jurisdiction}. Each party irrevocably submits to the exclusive jurisdiction of such ${d.jurisdiction} in any such suit, action, or proceeding.`,
  },
  {
    number: "10",
    title: "Equitable Relief",
    body: () =>
      `A breach of this MNDA may cause irreparable harm for which monetary damages are an insufficient remedy. Upon a breach of this MNDA, the Disclosing Party is entitled to seek appropriate equitable relief, including an injunction, in addition to its other remedies.`,
  },
  {
    number: "11",
    title: "General",
    body: () =>
      `Neither party has an obligation under this MNDA to disclose Confidential Information to the other or proceed with any proposed transaction. Neither party may assign this MNDA without the prior written consent of the other party, except that either party may assign this MNDA in connection with a merger, reorganization, acquisition or other transfer of all or substantially all its assets or voting securities. Any assignment in violation of this Section is null and void. This MNDA will bind and inure to the benefit of each party’s permitted successors and assigns. Waivers must be signed by the waiving party’s authorized representative and cannot be implied from conduct. If any provision of this MNDA is held unenforceable, it will be limited to the minimum extent necessary so the rest of this MNDA remains in effect. This MNDA (including the Cover Page) constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, regarding such subject matter. This MNDA may only be amended, modified, waived, or supplemented by an agreement in writing signed by both parties. Notices, requests and approvals under this MNDA must be sent in writing to the email or postal addresses on the Cover Page and are deemed delivered on receipt. This MNDA may be executed in counterparts, including electronic copies, each of which is deemed an original and which together form the same agreement.`,
  },
];

function StandardTermsPage({ data }: { data: NdaFormData }) {
  return (
    <Page size="LETTER" style={pdfStyles.page} wrap>
      <Text style={pdfStyles.h1}>Standard Terms</Text>
      {PARAGRAPHS.map((p) => (
        <Text key={p.number} style={pdfStyles.paragraph}>
          <Text style={pdfStyles.paragraphTitle}>{`${p.number}. ${p.title}.`}</Text>
          {` ${p.body(data)}`}
        </Text>
      ))}
      <Text style={pdfStyles.footer}>
        Common Paper Mutual Non-Disclosure Agreement Version 1.0 free to use
        under CC BY 4.0.
      </Text>
    </Page>
  );
}