import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteCustomization,
  fetchAgentConfig,
  fetchCard,
  fetchPatients,
  sendFeedback,
  setActiveVersion,
  simulateAdvance,
  startDelta,
  startPrevisit,
  subscribeRun,
} from "./api";
import type { AgentConfigResponse, DeltaCard, Patient, RoomEntryCard, RunEvent } from "./types";
import { Header } from "./components/Header";
import { Schedule } from "./components/Schedule";
import { PatientView } from "./components/PatientView";
import { CustomizationsDrawer, PromptDrawer, VersionsDrawer } from "./components/Drawers";

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [config, setConfig] = useState<AgentConfigResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, RoomEntryCard | null>>({});
  const [deltaCards, setDeltaCards] = useState<Record<string, DeltaCard | null>>({});
  const [events, setEvents] = useState<Record<string, RunEvent[]>>({});
  const [runMode, setRunMode] = useState<Record<string, "previsit" | "delta">>({});
  const [runningPatientId, setRunningPatientId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | "prompt" | "customizations" | "versions">(null);
  const unsubscribe = useRef<(() => void) | null>(null);

  const refreshPatients = useCallback(async () => setPatients(await fetchPatients()), []);
  const refreshConfig = useCallback(async () => setConfig(await fetchAgentConfig()), []);

  useEffect(() => {
    refreshPatients();
    refreshConfig();
  }, [refreshPatients, refreshConfig]);

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  const runAgent = useCallback(
    async (patient: Patient, mode: "previsit" | "delta") => {
      setSelectedId(patient.id);
      setRunningPatientId(patient.id);
      setRunMode((m) => ({ ...m, [patient.id]: mode }));
      setEvents((e) => ({ ...e, [patient.id]: [] }));
      if (mode === "previsit") {
        setCards((c) => ({ ...c, [patient.id]: null }));
        setDeltaCards((c) => ({ ...c, [patient.id]: null }));
      }
      const runId = mode === "previsit" ? await startPrevisit(patient.id) : await startDelta(patient.id);
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

  const viewPatient = useCallback(
    async (patient: Patient) => {
      setSelectedId(patient.id);
      if (!cards[patient.id]) {
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
    await simulateAdvance(selected.id);
    await refreshPatients();
  }, [selected, refreshPatients]);

  const stageLabel = selected ? (selected.releasedStages > 0 ? selected.nextStageLabel ?? null : null) : null;

  return (
    <div className="min-h-screen">
      <Header
        config={config}
        onShowPrompt={() => setDrawer("prompt")}
        onShowCustomizations={() => setDrawer("customizations")}
        onShowVersions={() => setDrawer("versions")}
      />

      {!selected ? (
        <Schedule
          patients={patients}
          runningPatientId={runningPatientId}
          onRun={(p) => runAgent(p, "previsit")}
          onView={viewPatient}
        />
      ) : (
        <PatientView
          patient={selected}
          card={cards[selected.id] ?? null}
          deltaCard={deltaCards[selected.id] ?? null}
          events={events[selected.id] ?? []}
          mode={runMode[selected.id] ?? "previsit"}
          running={runningPatientId === selected.id}
          onBack={() => setSelectedId(null)}
          onRegenerate={() => runAgent(selected, "previsit")}
          onSimulateAdvance={handleSimulateAdvance}
          onRunDelta={() => runAgent(selected, "delta")}
          onTeach={handleTeach}
          versionId={config?.activeVersionId ?? "v1.0"}
          versionLabel={config?.activeVersion?.label ?? "Base scaffold"}
          stageLabel={selected.releasedStages > 0 ? `Stage ${selected.releasedStages} results in` : stageLabel}
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
