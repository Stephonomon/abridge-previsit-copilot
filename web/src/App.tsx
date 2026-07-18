import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteCustomization,
  fetchAgentConfig,
  fetchCard,
  fetchPatients,
  resetWorkspace,
  sendFeedback,
  setActiveVersion,
  simulateAdvance,
  startDelta,
  startPrevisit,
  subscribeRun,
} from "./api";
import type { AgentConfigResponse, DeltaCard, Patient, RoomEntryCard, RunEvent } from "./types";
import { EhrTopBar } from "./ehr/EhrChrome";
import { Trackboard } from "./ehr/Trackboard";
import { PatientChart } from "./ehr/PatientChart";
import { CopilotOverlay } from "./components/CopilotOverlay";
import { DemoControls } from "./components/DemoControls";
import { CustomizationsDrawer, PromptDrawer, VersionsDrawer } from "./components/Drawers";

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [config, setConfig] = useState<AgentConfigResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copilotOpenFor, setCopilotOpenFor] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, RoomEntryCard | null>>({});
  const [deltaCards, setDeltaCards] = useState<Record<string, DeltaCard | null>>({});
  const [events, setEvents] = useState<Record<string, RunEvent[]>>({});
  const [runMode, setRunMode] = useState<Record<string, "previsit" | "delta">>({});
  const [runningPatientId, setRunningPatientId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | "prompt" | "customizations" | "versions">(null);
  const [chartVersion, setChartVersion] = useState(0); // bump → EHR chart refetch
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState<Record<string, boolean>>({});
  const unsubscribe = useRef<(() => void) | null>(null);

  const markSeen = useCallback((patientId: string) => {
    setHasUnseenUpdate((m) => (m[patientId] ? { ...m, [patientId]: false } : m));
  }, []);

  const refreshPatients = useCallback(async () => setPatients(await fetchPatients()), []);
  const refreshConfig = useCallback(async () => setConfig(await fetchAgentConfig()), []);

  useEffect(() => {
    refreshPatients();
    refreshConfig();
  }, [refreshPatients, refreshConfig]);

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  const runAgent = useCallback(
    async (patient: Patient, mode: "previsit" | "delta", releasedStagesOverride?: number) => {
      setRunningPatientId(patient.id);
      setRunMode((m) => ({ ...m, [patient.id]: mode }));
      setEvents((e) => ({ ...e, [patient.id]: [] }));
      if (mode === "previsit") {
        setCards((c) => ({ ...c, [patient.id]: null }));
        setDeltaCards((c) => ({ ...c, [patient.id]: null }));
      }
      const runId =
        mode === "previsit"
          ? await startPrevisit(patient.id)
          : await startDelta(patient.id, releasedStagesOverride ?? patient.releasedStages);
      unsubscribe.current?.();
      unsubscribe.current = subscribeRun(runId, (event) => {
        setEvents((e) => ({ ...e, [patient.id]: [...(e[patient.id] ?? []), event] }));
        if (event.type === "card_ready") setCards((c) => ({ ...c, [patient.id]: event.card }));
        if (event.type === "delta_ready") setDeltaCards((c) => ({ ...c, [patient.id]: event.card }));
        if (event.type === "run_complete" || event.type === "run_error") {
          setRunningPatientId(null);
          refreshPatients();
        }
      });
    },
    [refreshPatients]
  );

  const launchCopilot = useCallback(
    async (patient: Patient) => {
      setCopilotOpenFor(patient.id);
      // hydrate an existing card if one was generated earlier
      if (!cards[patient.id] && patient.hasCard) {
        const j = await fetchCard(patient.id);
        if (j.card) setCards((c) => ({ ...c, [patient.id]: j.card }));
      }
    },
    [cards]
  );

  const handleTeach = useCallback(
    async (sectionId: string, instruction: string) => {
      await sendFeedback(sectionId, instruction);
      await refreshConfig();
    },
    [refreshConfig]
  );

  const handleSimulateAdvance = useCallback(async () => {
    if (!selected) return;
    const result = await simulateAdvance(selected.id, selected.releasedStages);
    await refreshPatients();
    setChartVersion((v) => v + 1); // new results also appear in the EHR chart tabs
    // Abridge AI's CDS ribbon reflects the new stage instantly (no LLM wait) —
    // flag the AI icon(s) until the user actually looks.
    setHasUnseenUpdate((m) => ({ ...m, [selected.id]: true }));
    // Auto-run the delta agent on the freshly released stage so new results
    // surface without a separate manual "Run Delta" click. Don't gate this on
    // cards[selected.id] being populated client-side — the pre-visit agent is
    // always auto-triggered on chart open, and the server hydrates its card
    // from the replay cache on demand even while that replay is still
    // mid-animation, so the delta call succeeds regardless of client timing.
    if (result?.releasedStages > 0) {
      await runAgent(selected, "delta", result.releasedStages);
    }
  }, [selected, refreshPatients, runAgent]);

  return (
    <div className="min-h-screen bg-[#c8d4dc]">
      <EhrTopBar
        tabTitle={selected ? selected.name.split(" ").reverse().join(", ") : undefined}
        onHome={() => {
          setSelectedId(null);
          setCopilotOpenFor(null);
        }}
        onResetWorkspace={resetWorkspace}
      />

      {!selected ? (
        <Trackboard
          patients={patients}
          onOpenChart={(p) => {
            setSelectedId(p.id);
            setCopilotOpenFor(null);
            // For the sake of time, the pre-visit brief is ready before the
            // user even opens the copilot window — no manual "Run" click needed.
            if (!p.hasCard) runAgent(p, "previsit");
          }}
        />
      ) : (
        <PatientChart
          patient={selected}
          copilotActive={copilotOpenFor === selected.id}
          hasUnseenUpdate={!!hasUnseenUpdate[selected.id]}
          onLaunchCopilot={() => {
            markSeen(selected.id);
            launchCopilot(selected);
          }}
          chartVersion={chartVersion}
        />
      )}

      {selected && (
        <DemoControls
          patient={selected}
          hasCard={!!cards[selected.id]}
          onSimulateAdvance={handleSimulateAdvance}
          onRunDelta={() => runAgent(selected, "delta")}
        />
      )}

      {selected && copilotOpenFor === selected.id && (
        <CopilotOverlay
          key={selected.id}
          patient={selected}
          config={config}
          card={cards[selected.id] ?? null}
          deltaCard={deltaCards[selected.id] ?? null}
          events={events[selected.id] ?? []}
          mode={runMode[selected.id] ?? "previsit"}
          running={runningPatientId === selected.id}
          hasUnseenUpdate={!!hasUnseenUpdate[selected.id]}
          onSeen={() => markSeen(selected.id)}
          onClose={() => setCopilotOpenFor(null)}
          onRun={() => runAgent(selected, "previsit")}
          onTeach={handleTeach}
          onShowPrompt={() => setDrawer("prompt")}
          onShowCustomizations={() => setDrawer("customizations")}
          onShowVersions={() => setDrawer("versions")}
        />
      )}

      {drawer === "prompt" && config && <PromptDrawer config={config} onClose={() => setDrawer(null)} />}
      {drawer === "customizations" && config && (
        <CustomizationsDrawer
          config={config}
          onClose={() => setDrawer(null)}
          onDelete={async (id) => {
            await deleteCustomization(id);
            await refreshConfig();
          }}
        />
      )}
      {drawer === "versions" && config && (
        <VersionsDrawer
          config={config}
          onClose={() => setDrawer(null)}
          onActivate={async (versionId) => {
            await setActiveVersion(versionId);
            await refreshConfig();
            setDrawer(null);
          }}
        />
      )}
    </div>
  );
}
