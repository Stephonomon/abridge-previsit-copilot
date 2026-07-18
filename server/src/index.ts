import "./env.js";
import express from "express";
import cors from "cors";
import { PORT } from "./env.js";
import { currentPending, getPatient, loadAllPatients } from "./data/store.js";
import { createRun, emit, getRun } from "./events/bus.js";
import { runPrevisit } from "./agents/orchestrator.js";
import { runDelta } from "./agents/delta.js";
import {
  addFeedback,
  getConfig,
  removeCustomization,
  renameVersion,
  setActiveVersion,
  activeVersion,
} from "./store/agentConfig.js";
import { basePrompt } from "./agents/prompts.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/patients", (_req, res) => {
  const patients = loadAllPatients()
    .sort((a, b) => a.meta.arrivalTime.localeCompare(b.meta.arrivalTime))
    .map((r) => ({
    ...r.meta,
    hasCard: !!r.lastCard,
    lastCardAt: r.lastCardAt,
    releasedStages: r.releasedStages,
    totalStages: r.events.stages.length,
    nextStageLabel: r.events.stages[r.releasedStages]?.label ?? null,
    pending: currentPending(r),
    deltaAvailable: r.releasedStages > r.lastDeltaCheckedStage,
  }));
  res.json({ patients });
});

app.get("/api/patients/:id/card", (req, res) => {
  const rec = getPatient(req.params.id);
  res.json({ card: rec.lastCard, lastCardAt: rec.lastCardAt, pending: currentPending(rec) });
});

app.post("/api/patients/:id/previsit", (req, res) => {
  const rec = getPatient(req.params.id);
  const run = createRun(rec.meta.id, "previsit");
  runPrevisit(run, rec).catch((e) => {
    console.error("previsit run failed", e);
    emit(run, { type: "run_error", message: String(e?.message ?? e), at: Date.now() });
  });
  res.json({ runId: run.id });
});

app.post("/api/patients/:id/simulate-advance", (req, res) => {
  const rec = getPatient(req.params.id);
  if (rec.releasedStages < rec.events.stages.length) rec.releasedStages++;
  const stage = rec.events.stages[rec.releasedStages - 1];
  res.json({
    releasedStages: rec.releasedStages,
    totalStages: rec.events.stages.length,
    label: stage?.label ?? null,
    deltaAvailable: rec.releasedStages > rec.lastDeltaCheckedStage,
  });
});

app.post("/api/patients/:id/delta", (req, res) => {
  const rec = getPatient(req.params.id);
  if (!rec.lastCard) {
    res.status(400).json({ error: "Run the pre-visit agent first" });
    return;
  }
  const run = createRun(rec.meta.id, "delta");
  runDelta(run, rec).catch((e) => {
    console.error("delta run failed", e);
    emit(run, { type: "run_error", message: String(e?.message ?? e), at: Date.now() });
  });
  res.json({ runId: run.id });
});

app.get("/api/runs/:runId/stream", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  // Replay buffered events so late subscribers see the whole run
  for (const e of run.events) send(e);
  if (run.done) {
    res.end();
    return;
  }
  const listener = (e: unknown) => {
    send(e);
    if ((e as any).type === "run_complete" || (e as any).type === "run_error") res.end();
  };
  run.emitter.on("event", listener);
  req.on("close", () => run.emitter.off("event", listener));
});

// ---- Agent config: prompt viewing, versions, feedback ----
app.get("/api/agent-config/:specialty", (req, res) => {
  const cfg = getConfig(req.params.specialty);
  res.json({
    ...cfg,
    basePrompt: basePrompt(req.params.specialty, "previsit"),
    deltaPrompt: basePrompt(req.params.specialty, "delta"),
    activeVersion: activeVersion(cfg),
  });
});

app.post("/api/agent-config/:specialty/feedback", (req, res) => {
  const { section, instruction } = req.body ?? {};
  if (!instruction) {
    res.status(400).json({ error: "instruction required" });
    return;
  }
  const cfg = addFeedback(req.params.specialty, section ?? "global", instruction);
  res.json({ ...cfg, activeVersion: activeVersion(cfg) });
});

app.post("/api/agent-config/:specialty/active-version", (req, res) => {
  const cfg = setActiveVersion(req.params.specialty, req.body?.versionId);
  res.json({ ...cfg, activeVersion: activeVersion(cfg) });
});

app.delete("/api/agent-config/:specialty/customizations/:id", (req, res) => {
  const cfg = removeCustomization(req.params.specialty, req.params.id);
  res.json({ ...cfg, activeVersion: activeVersion(cfg) });
});

app.post("/api/agent-config/:specialty/versions/:versionId/label", (req, res) => {
  const cfg = renameVersion(req.params.specialty, req.params.versionId, req.body?.label ?? "");
  res.json({ ...cfg, activeVersion: activeVersion(cfg) });
});

app.listen(PORT, () => {
  console.log(`Pre-Visit Copilot server on http://localhost:${PORT}`);
});
