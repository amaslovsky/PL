"use client";

import type { NdaFormData, Party } from "@/lib/types";
import { formatIsoAsLongDateUtc } from "@/lib/date";

interface NdaFormProps {
  data: NdaFormData;
  onChange: (patch: Partial<NdaFormData>) => void;
}

const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "mb-1 block text-xs font-medium text-zinc-700";

export function NdaForm({ data, onChange }: NdaFormProps) {
  const setParty = <K extends "party1" | "party2">(
    which: K,
    patch: Partial<NdaFormData[K]>,
  ): void => {
    onChange({ [which]: { ...data[which], ...patch } } as Partial<NdaFormData>);
  };

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Section title="Parties">
        <PartyFields
          heading="Party 1"
          party={data.party1}
          onChange={(patch) => setParty("party1", patch)}
        />
        <PartyFields
          heading="Party 2"
          party={data.party2}
          onChange={(patch) => setParty("party2", patch)}
        />
      </Section>

      <Section title="Mutual NDA details">
        <Field label="Purpose">
          <textarea
            className={`${inputClass} min-h-[64px]`}
            value={data.purpose}
            onChange={(e) => onChange({ purpose: e.target.value })}
          />
        </Field>
        <Field label="Effective Date">
          <input
            type="date"
            className={inputClass}
            value={data.effectiveDate}
            onChange={(e) => {
              const iso = e.target.value;
              onChange({
                effectiveDate: iso,
                effectiveDateDisplay: formatIsoAsLongDateUtc(iso),
              });
            }}
          />
        </Field>
      </Section>

      <Section title="MNDA Term">
        <RadioRow
          name="ndaTerm"
          checked={data.ndaTerm.mode === "expires"}
          onChange={() => onChange({ ndaTerm: { ...data.ndaTerm, mode: "expires" } })}
          label={
            <span className="flex items-center gap-2">
              Expires
              <input
                type="number"
                min={1}
                max={99}
                disabled={data.ndaTerm.mode !== "expires"}
                className={`${inputClass} w-16 py-1`}
                value={data.ndaTerm.years}
                onChange={(e) =>
                  onChange({
                    ndaTerm: { ...data.ndaTerm, years: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
              year(s) from Effective Date.
            </span>
          }
        />
        <RadioRow
          name="ndaTerm"
          checked={data.ndaTerm.mode === "continues"}
          onChange={() => onChange({ ndaTerm: { ...data.ndaTerm, mode: "continues" } })}
          label="Continues until terminated in accordance with the terms of the MNDA."
        />
      </Section>

      <Section title="Term of Confidentiality">
        <RadioRow
          name="confTerm"
          checked={data.confidentialityTerm.mode === "years"}
          onChange={() =>
            onChange({
              confidentialityTerm: { ...data.confidentialityTerm, mode: "years" },
            })
          }
          label={
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                disabled={data.confidentialityTerm.mode !== "years"}
                className={`${inputClass} w-16 py-1`}
                value={data.confidentialityTerm.years}
                onChange={(e) =>
                  onChange({
                    confidentialityTerm: {
                      ...data.confidentialityTerm,
                      years: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
              />
              year(s) from Effective Date, but in the case of trade secrets
              until Confidential Information is no longer considered a trade
              secret under applicable laws.
            </span>
          }
        />
        <RadioRow
          name="confTerm"
          checked={data.confidentialityTerm.mode === "perpetuity"}
          onChange={() =>
            onChange({
              confidentialityTerm: {
                ...data.confidentialityTerm,
                mode: "perpetuity",
              },
            })
          }
          label="In perpetuity."
        />
      </Section>

      <Section title="Governing Law & Jurisdiction">
        <Field label="Governing Law (state)">
          <input
            className={inputClass}
            value={data.governingLaw}
            placeholder="Delaware"
            onChange={(e) => onChange({ governingLaw: e.target.value })}
          />
        </Field>
        <Field label="Jurisdiction (city/county, state)">
          <input
            className={inputClass}
            value={data.jurisdiction}
            placeholder="New Castle County, Delaware"
            onChange={(e) => onChange({ jurisdiction: e.target.value })}
          />
        </Field>
      </Section>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers — kept in this file because they're only used
// by the form. If a second form appears, extract to `components/Form.tsx`.
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-700">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function PartyFields({
  heading,
  party,
  onChange,
}: {
  heading: string;
  party: Party;
  onChange: (patch: Partial<Party>) => void;
}) {
  return (
    <fieldset className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
      <legend className="px-1 text-xs font-medium text-zinc-600">{heading}</legend>
      <div className="space-y-2">
        <Field label="Name">
          <input
            className={inputClass}
            value={party.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <input
            className={inputClass}
            value={party.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        </Field>
      </div>
    </fieldset>
  );
}

function RadioRow({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1"
      />
      <span>{label}</span>
    </label>
  );
}