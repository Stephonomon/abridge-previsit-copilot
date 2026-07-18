import { useEffect, useRef, useState } from "react";
import type { AgentConfigResponse, CdsResult, DeltaCard, Patient, RoomEntryCard, RunEvent } from "../types";
import { fetchCds } from "../api";
import { ActivityPanel } from "./ActivityPanel";
import { CardView } from "./CardView";
import { CdsPanel } from "./CdsPanel";
import { DeltaCardView } from "./DeltaCardView";
import { Eye, Sliders, Sparkle, Stethoscope } from "./icons";

const DEFAULT_W = 900;
const MIN_W = 420;
const MIN_H = 300;
const BUBBLE = 56;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const defaultH = () => Math.min(720, window.innerHeight - 24);

type XY = { x: number; y: number };
type WH = { w: number; h: number };

/**
 * The Pre-Visit Copilot as a free-floating in-EHR window:
 * - draggable by its title bar, resizable from the bottom-right corner
 * - collapses to a small draggable floating icon (hover or click to expand)
 * - Abridge AI clinical decision support sits at the top, always live (pure
 *   rules matching over the current chart stage — no LLM wait). Below it, the
 *   AI-narrated chart summary is collapsed by default; expand it to show the
 *   full multi-agent pull.
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
  const [dragging, setDragging] = useState(false);
  const [showActivity, setShowActivity] = useState(false); // collapsed by default
  const [showSummary, setShowSummary] = useState(false); // AI chart summary — collapsed by default
  const [cds, setCds] = useState<CdsResult | null>(null);
  const expanded = pinned || hovering;

  useEffect(() => {
    let cancelled = false;
    fetchCds(patient.id).then((res) => {
      if (!cancelled) setCds(res);
    });
    return () => {
      cancelled = true;
    };
  }, [patient.id, patient.releasedStages]);

  const [winPos, setWinPos] = useState<XY>(() => ({
    x: clamp(window.innerWidth - DEFAULT_W - 16, 8, window.innerWidth - DEFAULT_W - 8),
    y: 76,
  }));
  const [winSize, setWinSize] = useState<WH>(() => ({ w: DEFAULT_W, h: defaultH() }));
  const [bubblePos, setBubblePos] = useState<XY>(() => ({
    x: window.innerWidth - BUBBLE - 24,
    y: window.innerHeight - BUBBLE - 24,
  }));

  const leaveTimer = useRef<number | null>(null);
  const busyRef = useRef(false); // true during any drag/resize — suppresses auto-collapse + click-expand
  const movedRef = useRef(false);

  const onEnter = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    if (!busyRef.current) setHovering(true);
  };
  const onLeave = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    if (busyRef.current) return; // never collapse mid-drag/resize
    leaveTimer.current = window.setTimeout(() => {
      if (!busyRef.current) setHovering(false);
    }, 350);
  };

  function beginDrag(e: React.PointerEvent, target: "win" | "bubble") {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const orig = target === "win" ? { ...winPos } : { ...bubblePos };
    let moved = false;
    busyRef.current = true;
    movedRef.current = false;
    setDragging(true);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      const w = target === "win" ? winSize.w : BUBBLE;
      const h = target === "win" ? winSize.h : BUBBLE;
      const nx = clamp(orig.x + dx, 4, window.innerWidth - w - 4);
      const ny = clamp(orig.y + dy, 4, window.innerHeight - h - 4);
      if (target === "win") setWinPos({ x: nx, y: ny });
      else setBubblePos({ x: nx, y: ny });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      busyRef.current = false;
      movedRef.current = moved;
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function beginResize(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const orig = { ...winSize };
    busyRef.current = true;
    setDragging(true);

    const move = (ev: PointerEvent) => {
      const dw = ev.clientX - start.x;
      const dh = ev.clientY - start.y;
      const w = clamp(orig.w + dw, MIN_W, window.innerWidth - winPos.x - 8);
      const h = clamp(orig.h + dh, MIN_H, window.innerHeight - winPos.y - 8);
      setWinSize({ w, h });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      busyRef.current = false;
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const collapse = () => {
    setPinned(false);
    setHovering(false);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
  };

  // Opening the activity panel widens a narrow window so both columns fit.
  function toggleActivity() {
    setShowActivity((prev) => {
      const next = !prev;
      if (next) {
        setWinSize((sz) => {
          if (sz.w >= 900) return sz;
          const w = Math.min(window.innerWidth - 16, sz.w + 360);
          setWinPos((p) => ({ x: clamp(p.x, 4, window.innerWidth - w - 4), y: p.y }));
          return { w, h: sz.h };
        });
      }
      return next;
    });
  }

  const canAdvance = patient.releasedStages < patient.totalStages;
  const customizationCount = config?.activeVersion?.customizations.length ?? 0;

  // ---- Collapsed: small draggable floating icon ----
  if (!expanded) {
    return (
      <button
        onPointerDown={(e) => beginDrag(e, "bubble")}
        onMouseEnter={onEnter}
        onClick={() => {
          if (movedRef.current) return; // was a drag, not a click
          setHovering(true);
        }}
        title="Pre-Visit Copilot — drag to move, click or hover to expand"
        className={`fixed z-50 rounded-full bg-indigo-brand text-white shadow-[0_8px_24px_-4px_rgba(91,91,214,0.6)] grid place-items-center border-2 border-white/70 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ left: bubblePos.x, top: bubblePos.y, width: BUBBLE, height: BUBBLE }}
      >
        <Sparkle className="w-6 h-6" />
        {cds?.ribbon.some((t) => t.badge === "emergency") ? (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white animate-pulse" title="Emergency recommendation" />
        ) : (
          card && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" title="Card ready" />
        )}
      </button>
    );
  }

  // ---- Expanded: draggable + resizable floating window ----
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`fixed z-50 flex flex-col rounded-2xl shadow-[0_16px_56px_-8px_rgba(28,25,23,0.5)] border border-indigo-brand/25 overflow-hidden bg-cream/95 backdrop-blur-md select-none ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={{ left: winPos.x, top: winPos.y, width: winSize.w, height: winSize.h }}
    >
      {/* Title bar (drag handle) */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/90 border-b border-stone-200 shrink-0">
        <div
          onPointerDown={(e) => beginDrag(e, "win")}
          className={`flex items-center gap-3 flex-1 min-w-0 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          title="Drag to move"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-brand text-white grid place-items-center shrink-0">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-bold text-[14px] flex items-center gap-1.5">
              Pre-Visit Copilot
              <svg className="w-3.5 h-3.5 text-stone-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </div>
            <div className="text-[11px] text-stone-500 truncate">
              Patient context: <span className="font-semibold text-stone-700">{patient.name}</span> · {patient.room}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
            onClick={() => setPinned(!pinned)}
            className={`p-1.5 rounded-full ${pinned ? "bg-indigo-brand text-white" : "hover:bg-stone-100 text-stone-500"}`}
            title={pinned ? "Unpin (collapses when you mouse away)" : "Pin window open"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4h6l1 6 2.5 2.5h-13L8 10l1-6z" />
              <line x1="12" y1="12.5" x2="12" y2="20" />
            </svg>
          </button>
          <button onClick={collapse} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500" title="Collapse to floating icon">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
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
              className="flex items-center gap-1.5 bg-indigo-brand hover:bg-indigo-brand-dark text-white rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm"
            >
              ⟳ Regenerate
            </button>
          </>
        )}

        {/* Simulate button still needs to be reachable even before the LLM card exists,
            since Abridge AI CDS reacts to stage changes independent of the narrative agent. */}
        {!card && canAdvance && (
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
      </div>

      {/* Body: Abridge AI CDS always up top; AI chart summary collapsed below it */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <CdsPanel cds={cds} patient={patient} />

        <div className="rounded-2xl border border-stone-200 bg-white/70 overflow-hidden">
          <button
            onClick={() => setShowSummary((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-stone-50"
          >
            <svg
              className={`w-3.5 h-3.5 text-stone-400 transition-transform ${showSummary ? "rotate-90" : ""}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
            <span className="text-[13px] font-bold text-stone-700">Chart summary</span>
            <span className="text-[11px] text-stone-400">— the AI-narrated pull from every sub-agent</span>
            {!showSummary && card && (
              <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                Ready
              </span>
            )}
          </button>

          {showSummary && (
            <div className="border-t border-stone-200 p-3">
              <div className="flex justify-end mb-2">
                <button
                  onClick={toggleActivity}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border ${
                    showActivity
                      ? "bg-indigo-soft border-indigo-brand/30 text-indigo-brand-dark"
                      : "bg-white border-stone-300 text-stone-600 hover:bg-stone-50"
                  }`}
                  title="Show what the sub-agents are doing behind the scenes"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
                  </svg>
                  {showActivity ? "Hide" : "Show"} agent activity
                  {running && (
                    <span className="relative flex w-2 h-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </button>
              </div>

              <div className={`grid gap-3 items-start ${showActivity ? "grid-cols-[1fr_330px]" : "grid-cols-1"}`}>
                <div className="space-y-3 min-w-0">
                  {deltaCard && (
                    <DeltaCardView card={deltaCard} stageLabel={patient.releasedStages > 0 ? `Stage ${patient.releasedStages} results in` : null} />
                  )}
                  <CardView
                    card={card}
                    loading={running}
                    patientHeader={{ name: patient.name, age: patient.age, sex: patient.sex, mrn: patient.mrn }}
                    onTeach={onTeach}
                  />
                </div>
                {showActivity && (
                  <div>
                    {events.length > 0 ? (
                      <ActivityPanel events={events} mode={mode} />
                    ) : (
                      <div className="bg-white/60 border border-dashed border-stone-300 rounded-2xl p-5 text-xs text-stone-400 text-center">
                        Sub-agent activity will stream here during a run.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resize grip (bottom-right) */}
      <div
        onPointerDown={beginResize}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-10"
        style={{ touchAction: "none" }}
        title="Drag to resize"
      >
        <svg className="w-full h-full text-stone-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M16 8 8 16M16 13l-3 3" />
        </svg>
      </div>
    </div>
  );
}
