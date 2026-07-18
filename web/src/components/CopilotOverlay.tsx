import { useRef, useState } from "react";
import type { AgentConfigResponse, DeltaCard, Patient, RoomEntryCard, RunEvent } from "../types";
import { ActivityPanel } from "./ActivityPanel";
import { CardView } from "./CardView";
import { DeltaCardView } from "./DeltaCardView";
import { Eye, Sliders, Sparkle, Stethoscope } from "./icons";

/**
 * The Pre-Visit Copilot as an in-EHR overlay window:
 * hover to expand, mouse away to collapse, pin to keep open, X to close.
 */
export function CopilotOverlay({
  patient,
  config,
  card,
  deltaCard,
  events,
  mode,
  running,
  onClose,
  onRun,
  onSimulateAdvance,
  onRunDelta,
  onTeach,
  onShowPrompt,
  onShowCustomizations,
  onShowVersions,
}: {
  patient: Patient;
  config: AgentConfigResponse | null;
  card: RoomEntryCard | null;
  deltaCard: DeltaCard | null;
  events: RunEvent[];
  mode: "previsit" | "delta";
  running: boolean;
  onClose: () => void;
  onRun: () => void;
  onSimulateAdvance: () => Promise<void>;
  onRunDelta: () => void;
  onTeach: (sectionId: string, instruction: string) => Promise<void>;
  onShowPrompt: () => void;
  onShowCustomizations: () => void;
  onShowVersions: () => void;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(true); // open expanded on launch
  const [advancing, setAdvancing] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const expanded = pinned || hovering;

  const onEnter = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    setHovering(true);
  };
  const onLeave = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHovering(false), 350);
  };

  const canAdvance = patient.releasedStages < patient.totalStages;
  const customizationCount = config?.activeVersion?.customizations.length ?? 0;

  return (
    <div
      className="fixed right-3 top-[70px] bottom-3 z-40 flex items-start justify-end pointer-events-none"
      style={{ width: expanded ? 960 : 72 }}
    >
      <div
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={`pointer-events-auto transition-all duration-300 ease-out h-full flex flex-col rounded-2xl shadow-[0_12px_48px_-8px_rgba(28,25,23,0.45)] border border-indigo-brand/25 overflow-hidden ${
          expanded ? "w-[960px] bg-cream/95 backdrop-blur-md" : "w-[68px] bg-indigo-brand"
        }`}
      >
        {expanded ? (
          <>
            {/* Copilot window header */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white/90 border-b border-stone-200 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-brand text-white grid place-items-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-[14px]">Pre-Visit Copilot</div>
                <div className="text-[11px] text-stone-500">
                  Patient context: <span className="font-semibold text-stone-700">{patient.name}</span> · {patient.room}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={onShowVersions}
                  className="text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-2.5 py-1 flex items-center gap-1"
                  title="Agent versions"
                >
                  {config?.activeVersionId ?? "v1.0"}
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9.5 12 15l6-5.5" />
                  </svg>
                </button>
                <button onClick={onShowPrompt} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600" title="View base agent prompt">
                  <Eye />
                </button>
                <button onClick={onShowCustomizations} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600 relative" title="Your customizations">
                  <Sliders />
                  {customizationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-indigo-brand text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 grid place-items-center">
                      {customizationCount}
                    </span>
                  )}
                </button>
                <div className="w-px h-5 bg-stone-200 mx-1" />
                <button
                  onClick={() => {
                    setPinned(false);
                    setHovering(false);
                    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
                  }}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
                  title="Collapse to side rail"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>
                <button
                  onClick={() => setPinned(!pinned)}
                  className={`p-1.5 rounded-full ${pinned ? "bg-indigo-brand text-white" : "hover:bg-stone-100 text-stone-500"}`}
                  title={pinned ? "Unpin (collapses on mouse-away)" : "Pin window open"}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 4h6l1 6 2.5 2.5h-13L8 10l1-6z" />
                    <line x1="12" y1="12.5" x2="12" y2="20" />
                  </svg>
                </button>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-red-50 text-stone-500 hover:text-red-500" title="Close">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Action strip */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 border-b border-stone-200 shrink-0">
              {!card && !running && (
                <button
                  onClick={onRun}
                  className="flex items-center gap-2 bg-indigo-brand hover:bg-indigo-brand-dark text-white rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm"
                >
                  <Sparkle /> Run Pre-Visit Agent
                </button>
              )}
              {running && (
                <span className="text-sm text-stone-500 flex items-center gap-2">
                  <span className="relative flex w-2.5 h-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-brand opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-brand" />
                  </span>
                  Agents reviewing {patient.name}'s chart…
                </span>
              )}
              {card && !running && (
                <>
                  {canAdvance && (
                    <button
                      onClick={async () => {
                        setAdvancing(true);
                        await onSimulateAdvance();
                        setAdvancing(false);
                      }}
                      disabled={advancing}
                      className="flex items-center gap-1.5 bg-white border border-stone-300 hover:bg-stone-50 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                      title="Demo control: release the next wave of results into the chart"
                    >
                      ◷ {advancing ? "Time passing…" : `Simulate: ${patient.nextStageLabel ?? "time passes"}`}
                    </button>
                  )}
                  {patient.deltaAvailable && (
                    <button
                      onClick={onRunDelta}
                      className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm"
                    >
                      <Sparkle className="w-3.5 h-3.5" /> Run Delta — new results
                    </button>
                  )}
                  <button
                    onClick={onRun}
                    className="flex items-center gap-1.5 bg-indigo-brand hover:bg-indigo-brand-dark text-white rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm ml-auto"
                  >
                    ⟳ Regenerate
                  </button>
                </>
              )}
            </div>

            {/* Body: card + activity side by side */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-[1fr_330px] gap-3 items-start">
                <div className="space-y-3">
                  {deltaCard && <DeltaCardView card={deltaCard} stageLabel={patient.releasedStages > 0 ? `Stage ${patient.releasedStages} results in` : null} />}
                  <CardView
                    card={card}
                    loading={running}
                    patientHeader={{ name: patient.name, age: patient.age, sex: patient.sex, mrn: patient.mrn }}
                    onTeach={onTeach}
                  />
                </div>
                <div>
                  {events.length > 0 ? (
                    <ActivityPanel events={events} mode={mode} />
                  ) : (
                    <div className="bg-white/60 border border-dashed border-stone-300 rounded-2xl p-5 text-xs text-stone-400 text-center">
                      Sub-agent activity will stream here during a run.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Collapsed rail */
          <button
            onMouseEnter={onEnter}
            onClick={() => setHovering(true)}
            className="h-full w-full flex flex-col items-center gap-3 pt-4 text-white"
            title="Pre-Visit Copilot (hover or click to expand)"
          >
            <Sparkle className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-widest" style={{ writingMode: "vertical-rl" }}>
              PRE-VISIT COPILOT — {patient.name.toUpperCase()}
            </span>
            {card && <span className="w-2 h-2 rounded-full bg-emerald-300" title="Card ready" />}
          </button>
        )}
      </div>
    </div>
  );
}
