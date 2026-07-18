import { useEffect, useState } from "react";
import type { Patient } from "../types";
import { fetchChart } from "../api";
import { BED_COLORS, fmtDateTime, labFlag, labValue, refRange, storyboardAlert } from "./ehr";
import { ChartReview } from "./ChartReview";
import { Sparkle } from "../components/icons";

const TABS = ["SnapShot", "Chart Review", "Results Review", "Notes", "Orders", "Dispo"] as const;
const TAB_COLORS: Record<string, string> = {
  SnapShot: "border-t-sky-500",
  "Chart Review": "border-t-teal-500",
  "Results Review": "border-t-violet-500",
  Notes: "border-t-purple-500",
  Orders: "border-t-amber-500",
  Dispo: "border-t-rose-500",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

function NoteModal({ patientId, binaryId, title, onClose }: { patientId: string; binaryId: string; title: string; onClose: () => void }) {
  const [text, setText] = useState("Loading…");
  useEffect(() => {
    fetch(`/api/patients/${patientId}/binary/${binaryId}`).then(async (r) => setText(await r.text()));
  }, [patientId, binaryId]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded shadow-2xl w-[720px] max-w-[92vw] max-h-[80vh] flex flex-col border border-stone-300">
        <div className="px-4 py-2 bg-[#155676] text-white text-sm font-semibold flex items-center">
          {title}
          <button onClick={onClose} className="ml-auto hover:opacity-70">✕</button>
        </div>
        <pre className="p-5 text-[13px] whitespace-pre-wrap overflow-y-auto font-sans leading-relaxed">{text}</pre>
      </div>
    </div>
  );
}

function Storyboard({ patient, chart, onLaunchCopilot, copilotActive }: { patient: Patient; chart: any; onLaunchCopilot: () => void; copilotActive: boolean }) {
  const alert = storyboardAlert(chart);
  const vitals = patient as any;
  return (
    <aside className="w-[230px] shrink-0 bg-[#eef4f1] border-r border-stone-300 text-[12.5px] text-stone-700 overflow-y-auto" style={{ maxHeight: "calc(100vh - 64px)" }}>
      <div className="p-3 text-center border-b border-stone-200">
        <div className="w-16 h-16 mx-auto rounded-full bg-white border-4 border-[#b7d3e3] grid place-items-center text-xl font-bold text-[#12557d]">
          {initials(patient.name)}
        </div>
        <div className={`mt-2 text-white text-[12px] font-bold py-0.5 rounded ${BED_COLORS[patient.room] ?? "bg-stone-400"}`}>{patient.room}</div>
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          <div className="font-bold text-[15px] text-stone-900">{patient.name}</div>
          <button
            onClick={onLaunchCopilot}
            title="Pre-Visit Copilot — AI chart review for this patient"
            className={`w-6 h-6 rounded-full grid place-items-center transition-colors ${
              copilotActive ? "bg-indigo-brand text-white" : "bg-white border border-indigo-brand/40 text-indigo-brand hover:bg-indigo-soft"
            }`}
          >
            <Sparkle className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-stone-500">
          {patient.sex === "M" ? "Male" : "Female"}, {patient.age} y.o.
        </div>
        <div className="text-stone-500">MRN: {patient.mrn}</div>
        <div className="mt-1 text-stone-600">Code: <span className="font-semibold">Not on file</span></div>
      </div>

      {alert && (
        <div className="mx-2 mt-2 bg-amber-300/80 border border-amber-400 text-amber-950 text-[12px] font-semibold px-2 py-1 rounded">
          ⚠ {alert}
        </div>
      )}

      <Section title="Isolation">None</Section>
      <Section title="Attending">J. Lee, MD — Emergency Medicine</Section>
      <Section title="Allergies">
        {(chart.allergies ?? []).length === 0
          ? "NKDA"
          : (chart.allergies ?? []).map((a: any) => (
              <div key={a.id} className={a.criticality === "high" ? "text-red-700 font-semibold" : ""}>
                {a.code?.text} — {a.reaction?.[0]?.manifestation?.[0]?.text}
              </div>
            ))}
      </Section>
      <Section title="Chief Complaint">{patient.chiefComplaint}</Section>
      <Section title="Triage Vitals">
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <span>BP <b>{vitals.triageVitals?.bp ?? "—"}</b></span>
          <span>HR <b>{vitals.triageVitals?.hr ?? "—"}</b></span>
          <span>Temp <b>{vitals.triageVitals?.temp ?? "—"}</b></span>
          <span>RR <b>{vitals.triageVitals?.rr ?? "—"}</b></span>
          <span>SpO2 <b>{vitals.triageVitals?.spo2 ?? "—"}%</b></span>
          <span>Pain <b>{vitals.triageVitals?.pain ?? "—"}/10</b></span>
        </div>
      </Section>
      <Section title="Active Problems">
        {(chart.conditionsProblems ?? []).slice(0, 6).map((c: any) => (
          <div key={c.id}>• {c.code?.text}</div>
        ))}
      </Section>
      <Section title="Med Status">
        {(chart.medicationRequests ?? []).length} active orders
        {(chart.medicationAdministrations ?? []).length > 0 && <div>{(chart.medicationAdministrations ?? []).length} given this visit</div>}
      </Section>
      <Section title="ED Course">
        <div>Roomed {patient.arrivalLabel}</div>
        <div>{patient.pending.length} orders pending</div>
      </Section>
      <Section title="Disposition">No Disposition Selected</Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-stone-200">
      <div className="text-[10.5px] font-bold tracking-wider text-[#0d7a68] uppercase mb-0.5">{title}</div>
      {children}
    </div>
  );
}

export function PatientChart({
  patient,
  onLaunchCopilot,
  copilotActive,
  chartVersion,
}: {
  patient: Patient;
  onLaunchCopilot: () => void;
  copilotActive: boolean;
  chartVersion: number; // bump to refetch (e.g. after simulate-advance)
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Chart Review");
  const [data, setData] = useState<any | null>(null);
  const [note, setNote] = useState<{ binaryId: string; title: string } | null>(null);

  useEffect(() => {
    fetchChart(patient.id).then(setData);
  }, [patient.id, chartVersion]);

  if (!data) return <div className="p-8 text-stone-400 text-sm">Opening chart…</div>;
  const chart = data.chart;

  return (
    <div className="flex bg-white min-h-[calc(100vh-64px)] text-stone-800">
      <Storyboard patient={patient} chart={chart} onLaunchCopilot={onLaunchCopilot} copilotActive={copilotActive} />

      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-1 px-3 pt-2 bg-[#dde7ee] border-b border-stone-300">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-[13px] rounded-t border border-b-0 border-t-4 ${TAB_COLORS[t]} ${
                tab === t ? "bg-white border-x-stone-300 font-bold" : "bg-stone-100/70 border-x-stone-200 text-stone-500 hover:bg-white/70"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Chart Review" && (
          <div>
            <div className="px-4 py-2 text-[17px] font-semibold text-[#12557d] border-b border-stone-200">Chart Review</div>
            <ChartReview patientId={patient.id} chart={chart} onOpenBinary={(binaryId, title) => setNote({ binaryId, title })} />
          </div>
        )}

        {tab === "SnapShot" && (
          <div className="p-5 grid grid-cols-2 gap-4 text-[13px] max-w-4xl">
            <SnapCard title="Reason for Visit">
              <div className="font-semibold">{patient.chiefComplaint}</div>
              <div className="mt-1 text-stone-600">{patient.triageNote}</div>
            </SnapCard>
            <SnapCard title="Pending This Visit">
              {data.pending.map((p: string) => (
                <div key={p}>◷ {p}</div>
              ))}
            </SnapCard>
            <SnapCard title="Problem List">
              {(chart.conditionsProblems ?? []).map((c: any) => (
                <div key={c.id}>• {c.code?.text}</div>
              ))}
            </SnapCard>
            <SnapCard title="Family / Social">
              {(chart.familyMemberHistory ?? []).map((f: any) => (
                <div key={f.id}>
                  {f.relationship?.text}: {f.condition?.[0]?.code?.text}
                </div>
              ))}
              {(chart.observationsSocial ?? []).map((s: any) => (
                <div key={s.id}>{s.valueString}</div>
              ))}
            </SnapCard>
          </div>
        )}

        {tab === "Results Review" && (
          <div className="p-3">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  {["Collected", "Test", "Value", "Flag", "Ref Range"].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-semibold text-[12px] text-stone-500 border-b border-stone-300 bg-stone-50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...(chart.observationsLabs ?? [])]
                  .sort((a: any, b: any) => (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""))
                  .map((o: any) => {
                    const flag = labFlag(o);
                    return (
                      <tr key={o.id} className="hover:bg-[#eaf3fb]">
                        <td className="px-3 py-1.5 border-b border-stone-100">{fmtDateTime(o.effectiveDateTime)}</td>
                        <td className="px-3 py-1.5 border-b border-stone-100">{o.code?.text}</td>
                        <td className={`px-3 py-1.5 border-b border-stone-100 ${flag ? "font-bold" : ""}`}>{labValue(o)}</td>
                        <td className="px-3 py-1.5 border-b border-stone-100 text-red-600 font-bold">{flag}</td>
                        <td className="px-3 py-1.5 border-b border-stone-100">{refRange(o)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Notes" && (
          <div className="p-5 space-y-2 text-[13px] max-w-3xl">
            {(chart.documentReferencesClinicalNotes ?? []).map((n: any) => (
              <button
                key={n.id}
                onClick={() => setNote({ binaryId: (n.content?.[0]?.attachment?.url ?? "").replace("Binary/", ""), title: n.type?.text })}
                className="w-full text-left border border-stone-200 rounded p-3 hover:bg-[#eaf3fb]"
              >
                <div className="font-bold text-[#12557d]">{n.type?.text}</div>
                <div className="text-stone-500 text-xs">{fmtDateTime(n.date)}</div>
              </button>
            ))}
          </div>
        )}

        {tab === "Orders" && (
          <div className="p-5 text-[13px] max-w-3xl">
            <div className="font-semibold text-[15px] text-[#12557d] mb-2">Active Orders — This Visit</div>
            {data.pending.map((p: string) => (
              <div key={p} className="flex items-center gap-2 border-b border-stone-100 py-1.5">
                <span className="text-amber-500">◷</span> {p} <span className="ml-auto text-stone-400">In process</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Dispo" && <div className="p-6 text-stone-400 text-[13px]">No disposition selected.</div>}
      </div>

      {note && <NoteModal patientId={patient.id} binaryId={note.binaryId} title={note.title} onClose={() => setNote(null)} />}
    </div>
  );
}

function SnapCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-stone-200 rounded">
      <div className="px-3 py-1.5 bg-[#eef4f1] text-[#0d7a68] font-bold text-[12px] uppercase tracking-wide border-b border-stone-200">{title}</div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}
