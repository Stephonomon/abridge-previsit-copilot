import { useState } from "react";
import type { DeltaCard, Patient, RoomEntryCard, RunEvent } from "../types";
import { ActivityPanel } from "./ActivityPanel";
import { CardView } from "./CardView";
import { DeltaCardView } from "./DeltaCardView";
import { Sparkle } from "./icons";

export function PatientView({
  patient,
  card,
  deltaCard,
  events,
  mode,
  running,
  onBack,
  onRegenerate,
  onSimulateAdvance,
  onRunDelta,
  onTeach,
  versionId,
  versionLabel,
  stageLabel,
}: {
  patient: Patient;
  card: RoomEntryCard | null;
  deltaCard: DeltaCard | null;
  events: RunEvent[];
  mode: "previsit" | "delta";
  running: boolean;
  onBack: () => void;
  onRegenerate: () => void;
  onSimulateAdvance: () => void;
  onRunDelta: () => void;
  onTeach: (sectionId: string, instruction: string) => Promise<void>;
  versionId: string;
  versionLabel: string;
  stageLabel: string | null;
}) {
  const [advancing, setAdvancing] = useState(false);
  const canAdvance = patient.releasedStages < patient.totalStages;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-stone-50"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M14 5l-7 7 7 7" />
          </svg>
          Schedule
        </button>
        <div className="text-sm text-stone-500">
          EM Chart-Review Copilot · <span className="font-semibold text-stone-700">{versionId}</span> · {versionLabel}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {card && !running && (
            <>
              {canAdvance ? (
                <button
                  onClick={async () => {
                    setAdvancing(true);
                    await onSimulateAdvance();
                    setAdvancing(false);
                  }}
                  disabled={advancing}
                  className="flex items-center gap-2 bg-white border border-stone-300 hover:bg-stone-50 rounded-full px-4 py-2 text-sm font-semibold"
                  title="Demo control: release the next wave of results into the chart"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3.5 2" />
                  </svg>
                  {advancing ? "Time passing…" : `Simulate: ${patient.nextStageLabel ?? "time passes"}`}
                </button>
              ) : null}
              {patient.deltaAvailable && (
                <button
                  onClick={onRunDelta}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-sm animate-[pulse_2s_ease-in-out_2]"
                >
                  <Sparkle /> Run Delta Agent — new results
                </button>
              )}
              <button
                onClick={onRegenerate}
                className="flex items-center gap-2 bg-indigo-brand hover:bg-indigo-brand-dark text-white rounded-full px-4 py-2 text-sm font-semibold shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 0-2.3 6" />
                  <path d="M20 5v6h-6" />
                </svg>
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_420px] gap-5 items-start">
        <div className="space-y-5">
          {deltaCard && <DeltaCardView card={deltaCard} stageLabel={stageLabel} />}
          <CardView
            card={card}
            loading={running}
            patientHeader={{ name: patient.name, age: patient.age, sex: patient.sex, mrn: patient.mrn }}
            onTeach={onTeach}
          />
        </div>
        <div className="sticky top-20">
          {events.length > 0 ? (
            <ActivityPanel events={events} mode={mode} />
          ) : (
            <div className="bg-white/60 border border-dashed border-stone-300 rounded-2xl p-6 text-sm text-stone-400 text-center">
              Agent activity will appear here during a run.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
