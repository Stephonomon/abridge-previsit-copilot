import { useState } from "react";
import type { Patient } from "../types";
import { Sparkle } from "./icons";

/**
 * Simulate / Run Delta live outside the draggable copilot window, so they can
 * be triggered independently while recording without the floating window in
 * the way (or needing to be reopened).
 */
export function DemoControls({
  patient,
  hasCard,
  onSimulateAdvance,
  onRunDelta,
}: {
  patient: Patient;
  hasCard: boolean;
  onSimulateAdvance: () => Promise<void>;
  onRunDelta: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const canAdvance = patient.releasedStages < patient.totalStages;
  const canDelta = hasCard && patient.deltaAvailable;

  if (!canAdvance && !canDelta) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 bg-white/95 backdrop-blur border border-stone-200 rounded-full shadow-lg px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400 pl-1">Demo</span>
      {canAdvance && (
        <button
          onClick={async () => {
            setAdvancing(true);
            await onSimulateAdvance();
            setAdvancing(false);
          }}
          disabled={advancing}
          className="flex items-center gap-1.5 bg-white border border-stone-300 hover:bg-stone-50 disabled:opacity-60 rounded-full px-3.5 py-1.5 text-xs font-semibold"
          title="Release the next wave of results into the chart"
        >
          ◷ {advancing ? "Time passing…" : `Simulate: ${patient.nextStageLabel ?? "time passes"}`}
        </button>
      )}
      {canDelta && (
        <button
          onClick={onRunDelta}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm"
        >
          <Sparkle className="w-3.5 h-3.5" /> Run Delta — new results
        </button>
      )}
    </div>
  );
}
