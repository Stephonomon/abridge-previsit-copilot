import type { Patient } from "../types";
import { acuityBadge, BED_COLORS, elapsedSince } from "./ehr";

const FILTER_TABS = ["My Pts (3)", "All Pts (3)", "Next to See", "Wtg Room", "Admits", "Results", "Dispo"];

export function Trackboard({ patients, onOpenChart }: { patients: Patient[]; onOpenChart: (p: Patient) => void }) {
  return (
    <div className="bg-white min-h-screen text-[13px] text-stone-800">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-[19px] font-semibold text-[#0d7a68]">ED Track Board (Meridian ED)</h1>
        <div className="text-xs text-stone-500">Friday, July 18, 2026 · Attending: J. Lee, MD</div>
      </div>

      <div className="px-4 flex items-center gap-2 text-xs text-stone-600 pb-2">
        <span className="cursor-default">✎ Sign In</span>
        <span className="cursor-default">⟳ Refresh</span>
        <span className="cursor-default">▤ Visit Contacts</span>
        <span className="cursor-default">💬 Comments</span>
      </div>

      <div className="px-4 flex items-center gap-1 pb-2">
        {FILTER_TABS.map((t, i) => (
          <span
            key={t}
            className={`px-2.5 py-1 rounded-t border border-b-0 text-xs cursor-default ${
              i === 1 ? "bg-[#e6f4f1] border-[#0d7a68] text-[#0d7a68] font-semibold" : "bg-stone-100 border-stone-300 text-stone-500"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <table className="w-full border-t border-stone-300">
        <thead>
          <tr className="text-left text-[12px] text-stone-500 border-b border-stone-300 bg-stone-50">
            {["Bed", "Patient Name", "Sex", "Age", "Acuity", "Chief Complaint", "Arrival", "TT", "RN", "Att", "Lab Status", "Rad Status", "Note", "ED Dispo"].map((h) => (
              <th key={h} className="px-3 py-1.5 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => {
            const acuity = acuityBadge(p.esi);
            const labsDone = p.releasedStages > 0;
            return (
              <tr
                key={p.id}
                onClick={() => onOpenChart(p)}
                className="border-b border-stone-200 hover:bg-[#eaf3fb] cursor-pointer"
                title="Open chart"
              >
                <td className="px-0 py-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 self-stretch ${BED_COLORS[p.room] ?? "bg-stone-300"}`} style={{ minHeight: 34 }} />
                    <span className="font-semibold py-2">{p.room.replace("ED ", "ED")}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-bold italic text-[#12557d]">
                  {p.name.split(" ").reverse().join(", ")}
                </td>
                <td className="px-3 py-2">{p.sex}</td>
                <td className="px-3 py-2">{p.age}y</td>
                <td className="px-3 py-2">
                  <span className={`inline-grid place-items-center w-5 h-5 rounded-full text-[11px] font-bold ${acuity.cls}`}>{acuity.label}</span>
                </td>
                <td className="px-3 py-2">{p.chiefComplaint}</td>
                <td className="px-3 py-2">{p.arrivalLabel}</td>
                <td className="px-3 py-2 tabular-nums">{elapsedSince(`2026-07-18T${p.arrivalLabel.includes("9:") ? "09:12" : p.arrivalLabel.includes("10:") ? "10:41" : "11:58"}:00-04:00`)}</td>
                <td className="px-3 py-2 text-stone-500">RN{p.room.slice(-1)}</td>
                <td className="px-3 py-2 text-stone-500">LEE</td>
                <td className="px-3 py-2">
                  {labsDone ? <span className="text-emerald-600 font-semibold">✔ [new]</span> : <span className="text-stone-400">◷ pending</span>}
                </td>
                <td className="px-3 py-2 text-stone-400">{labsDone ? "✔ [1/1]" : "—"}</td>
                <td className="px-3 py-2">{p.hasCard ? <span className="text-emerald-600">✔</span> : <span className="text-stone-400">—</span>}</td>
                <td className="px-3 py-2 text-stone-400">—</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-2 text-[11px] text-stone-400">
        Simulated EHR for demo purposes only — all patients and data are synthetic. Click a patient row to open the chart.
      </div>
    </div>
  );
}
