import { useState } from "react";
import { fmtDate, fmtDateTime, labFlag, labValue, refRange } from "./ehr";

const SUBTABS = [
  "Encounters",
  "Notes",
  "Laboratory",
  "Imaging",
  "Cardiology",
  "Micro",
  "Medications",
  "Problems",
  "Allergies",
  "Procedures",
  "Media",
  "Referrals",
] as const;

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-1.5 text-left font-semibold text-[12px] text-stone-500 whitespace-nowrap border-b border-stone-300 bg-stone-50">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 border-b border-stone-100 align-top ${className}`}>{children}</td>;
}

function FiltersRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-[12px] text-stone-500 border-b border-stone-200">
      <span>🜄 Filters</span>
      {["Hide Add'l Visits", "My Encounters", "Admissions", "Office Visits", "Outside Records"].map((f, i) => (
        <label key={f} className="flex items-center gap-1 cursor-default">
          <input type="checkbox" readOnly checked={i === 0} className="accent-[#12557d]" /> {f}
        </label>
      ))}
    </div>
  );
}

export function ChartReview({ patientId, chart, onOpenBinary }: { patientId: string; chart: any; onOpenBinary: (binaryId: string, title: string) => void }) {
  const [tab, setTab] = useState<(typeof SUBTABS)[number]>("Encounters");

  const reports: any[] = chart.diagnosticReports ?? [];
  const imaging = reports.filter((r) => /radiology|imaging/i.test(r.category?.[0]?.text ?? ""));
  const cardiology = reports.filter((r) => /ecg|cardiac/i.test(r.category?.[0]?.text ?? ""));
  const micro = reports.filter((r) => /micro/i.test(r.category?.[0]?.text ?? ""));
  const otherReports = reports.filter((r) => !imaging.includes(r) && !cardiology.includes(r) && !micro.includes(r));

  const labs: any[] = [...(chart.observationsLabs ?? [])].sort((a, b) => (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""));
  const notes: any[] = chart.documentReferencesClinicalNotes ?? [];
  const media: any[] = chart.documentReferencesExternal ?? [];

  return (
    <div className="bg-white">
      <div className="flex items-center gap-0.5 px-2 pt-1.5 border-b border-stone-300 overflow-x-auto">
        {SUBTABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[13px] whitespace-nowrap rounded-t border border-b-0 ${
              tab === t ? "bg-white border-stone-300 font-bold text-[#12557d] -mb-px" : "bg-stone-100 border-stone-200 text-stone-500 hover:bg-stone-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <FiltersRow />

      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 210px)" }}>
        {tab === "Encounters" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>When</Th><Th>Encounter Type</Th><Th>Dept</Th><Th>Provider</Th><Th>Description / Dispo Dx</Th><Th>Class</Th></tr></thead>
            <tbody>
              {(chart.encounters ?? []).map((e: any) => (
                <tr key={e.id} className="hover:bg-[#eaf3fb]">
                  <Td>{fmtDate(e.period?.start)}</Td>
                  <Td>{e.type?.[0]?.text ?? "—"}</Td>
                  <Td>{e.class?.display === "Emergency" ? "Meridian ED" : "Meridian Medical Group"}</Td>
                  <Td>{e.class?.display === "Emergency" ? "ED Attending" : "Specialist"}</Td>
                  <Td className="max-w-[480px]">{e.extension?.find((x: any) => x.url === "dispositionDx")?.valueString ?? e.reasonCode?.[0]?.text ?? "—"}</Td>
                  <Td>{e.class?.display ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Laboratory" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Collected</Th><Th>Test</Th><Th>Value</Th><Th>Flag</Th><Th>Ref Range</Th><Th>Status</Th></tr></thead>
            <tbody>
              {labs.map((o: any) => {
                const flag = labFlag(o);
                return (
                  <tr key={o.id} className="hover:bg-[#eaf3fb]">
                    <Td>{fmtDateTime(o.effectiveDateTime)}</Td>
                    <Td>{o.code?.text ?? "—"}</Td>
                    <Td className={flag ? "font-bold" : ""}>{labValue(o)}</Td>
                    <Td>{flag && <span className="text-red-600 font-bold">{flag}{o.interpretation?.[0]?.coding?.[0]?.code === "HH" ? "H ⚠" : ""}</span>}</Td>
                    <Td>{refRange(o)}</Td>
                    <Td>{o.status ?? "final"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {(tab === "Imaging" || tab === "Cardiology" || tab === "Micro") && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Date</Th><Th>Study</Th><Th>Status</Th><Th>Impression</Th></tr></thead>
            <tbody>
              {(tab === "Imaging" ? imaging : tab === "Cardiology" ? [...cardiology, ...otherReports.filter((r) => /echo/i.test(r.code?.text ?? ""))] : micro).map((r: any) => (
                <tr key={r.id} className="hover:bg-[#eaf3fb]">
                  <Td>{fmtDate(r.effectiveDateTime)}</Td>
                  <Td className="font-semibold">{r.code?.text}</Td>
                  <Td className={r.status === "preliminary" ? "text-amber-600 font-semibold" : ""}>{r.status}</Td>
                  <Td className="max-w-[600px]">{r.conclusion}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Notes" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Author</Th><Th></Th></tr></thead>
            <tbody>
              {notes.map((n: any) => {
                const binaryId = (n.content?.[0]?.attachment?.url ?? "").replace("Binary/", "");
                return (
                  <tr key={n.id} className="hover:bg-[#eaf3fb]">
                    <Td>{fmtDate(n.date)}</Td>
                    <Td className="font-semibold">{n.type?.text}</Td>
                    <Td>{/cardiology/i.test(n.type?.text ?? "") ? "R. Whitman, MD" : /gi|gastro/i.test(n.type?.text ?? "") ? "S. Patel, MD" : "ED Attending"}</Td>
                    <Td>
                      <button onClick={() => onOpenBinary(binaryId, n.type?.text ?? "Note")} className="text-[#12557d] underline">
                        View note
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "Medications" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Medication</Th><Th>Sig</Th><Th>Start</Th><Th>Indication</Th><Th>Status</Th></tr></thead>
            <tbody>
              {[...(chart.medicationRequests ?? []), ...(chart.medicationAdministrations ?? [])].map((m: any) => (
                <tr key={m.id} className="hover:bg-[#eaf3fb]">
                  <Td className="font-semibold">{m.medicationCodeableConcept?.text}</Td>
                  <Td>{m.dosageInstruction?.[0]?.text ?? (m.resourceType === "MedicationAdministration" ? "given this visit" : "—")}</Td>
                  <Td>{fmtDate(m.authoredOn ?? m.effectiveDateTime)}</Td>
                  <Td>{m.reasonCode?.[0]?.text ?? m.note?.[0]?.text ?? "—"}</Td>
                  <Td>{m.status}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Problems" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Problem</Th><Th>Onset</Th><Th>Status</Th><Th>Comment</Th></tr></thead>
            <tbody>
              {[...(chart.conditionsProblems ?? []), ...(chart.conditionsMedicalHistory ?? [])].map((c: any) => (
                <tr key={c.id} className="hover:bg-[#eaf3fb]">
                  <Td className="font-semibold">{c.code?.text}</Td>
                  <Td>{fmtDate(c.onsetDateTime)}</Td>
                  <Td>{c.clinicalStatus?.coding?.[0]?.code}</Td>
                  <Td className="max-w-[420px]">{c.note?.[0]?.text ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Allergies" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Agent</Th><Th>Reaction</Th><Th>Severity</Th><Th>Criticality</Th></tr></thead>
            <tbody>
              {(chart.allergies ?? []).map((a: any) => (
                <tr key={a.id} className="hover:bg-[#eaf3fb]">
                  <Td className="font-semibold">{a.code?.text}</Td>
                  <Td>{a.reaction?.[0]?.manifestation?.[0]?.text ?? "—"}</Td>
                  <Td>{a.reaction?.[0]?.severity ?? "—"}</Td>
                  <Td className={a.criticality === "high" ? "text-red-600 font-bold" : ""}>{a.criticality}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Procedures" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Date</Th><Th>Procedure</Th><Th>Status</Th></tr></thead>
            <tbody>
              {(chart.procedures ?? []).map((p: any) => (
                <tr key={p.id} className="hover:bg-[#eaf3fb]">
                  <Td>{fmtDate(p.performedDateTime)}</Td>
                  <Td className="font-semibold">{p.code?.text}</Td>
                  <Td>{p.status}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Media" && (
          <table className="w-full text-[13px]">
            <thead><tr><Th>Received</Th><Th>Document</Th><Th>Source</Th><Th>Format</Th><Th></Th></tr></thead>
            <tbody>
              {media.map((d: any) => {
                const binaryId = (d.content?.[0]?.attachment?.url ?? "").replace("Binary/", "");
                const isPdf = d.content?.[0]?.attachment?.contentType === "application/pdf";
                return (
                  <tr key={d.id} className="hover:bg-[#eaf3fb]">
                    <Td>{fmtDate(d.date)}</Td>
                    <Td className="font-semibold">{d.type?.text}</Td>
                    <Td className="max-w-[380px]">{d.description ?? "—"}</Td>
                    <Td>{isPdf ? <span className="text-red-600 font-semibold">PDF (scanned fax)</span> : "text"}</Td>
                    <Td>
                      <a href={`/api/patients/${patientId}/binary/${binaryId}`} target="_blank" rel="noreferrer" className="text-[#12557d] underline">
                        Open document ↗
                      </a>
                    </Td>
                  </tr>
                );
              })}
              {media.length === 0 && <tr><Td className="text-stone-400">No scanned documents on file</Td><Td> </Td><Td> </Td><Td> </Td><Td> </Td></tr>}
            </tbody>
          </table>
        )}

        {tab === "Referrals" && (
          <div className="p-6 text-stone-400 text-[13px]">No open referrals for this encounter.</div>
        )}
      </div>
    </div>
  );
}
