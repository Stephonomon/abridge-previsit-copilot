import type { Patient } from "../types";
import { Clock, Sparkle, Doc } from "./icons";

const esiStyle: Record<number, string> = {
  1: "bg-red-100 text-red-700",
  2: "bg-red-100 text-red-700",
  3: "bg-amber-100 text-amber-700",
  4: "bg-emerald-100 text-emerald-700",
  5: "bg-emerald-100 text-emerald-700",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

export function Schedule({
  patients,
  runningPatientId,
  onRun,
  onView,
}: {
  patients: Patient[];
  runningPatientId: string | null;
  onRun: (p: Patient) => void;
  onView: (p: Patient) => void;
}) {
  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold">Today's schedule</h1>
        <div className="text-sm text-stone-500">
          Friday, July 18, 2026 · {patients.length} patients
        </div>
      </div>

      <div className="space-y-4">
        {patients.map((p) => {
          const running = runningPatientId === p.id;
          return (
            <div key={p.id} className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)] px-6 py-5 flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-indigo-soft text-indigo-brand-dark font-bold grid place-items-center text-base">
                {initials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-[17px]">{p.name}</span>
                  <span className="text-stone-500 text-sm">
                    {p.age}
                    {p.sex} · MRN {p.mrn}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${esiStyle[p.esi] ?? "bg-stone-100 text-stone-600"}`}>
                    ESI {p.esi}
                  </span>
                </div>
                <div className="text-[15px] mt-1 flex items-center gap-3">
                  <span className="font-medium">{p.chiefComplaint}</span>
                  <span className="text-stone-400 text-sm">ED Arrival · {p.room}</span>
                  {p.deltaAvailable && p.hasCard && (
                    <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md animate-pulse">
                      New results since last review
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-stone-500 text-sm">
                <Clock />
                {p.arrivalLabel}
              </div>
              {p.hasCard && !running ? (
                <button
                  onClick={() => onView(p)}
                  className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-full px-5 py-2.5 text-sm transition-colors"
                >
                  <Doc /> View Summary
                </button>
              ) : (
                <button
                  onClick={() => onRun(p)}
                  disabled={running}
                  className="flex items-center gap-2 bg-indigo-brand hover:bg-indigo-brand-dark disabled:opacity-70 text-white font-semibold rounded-full px-5 py-2.5 text-sm shadow-sm transition-colors"
                >
                  <Sparkle />
                  {running ? "Running…" : "Run Pre-Visit Agent"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
