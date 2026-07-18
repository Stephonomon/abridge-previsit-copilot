import "./env.js";
import express from "express";
import cors from "cors";
import { REPLAY_DELTA_MS, REPLAY_PREVISIT_MS, RUN_MODE } from "./env.js";
import { cacheKey, cardFromEvents, deltaFromEvents, readRunCache, replayRun } from "./cache.js";
import { chartForDisplay, currentPending, getPatient, loadAllPatients, readBinary, resetPatients } from "./data/store.js";
import { createRun, emit, getRun, type Run } from "./events/bus.js";
import { runPrevisit } from "./agents/orchestrator.js";
import { runDelta } from "./agents/delta.js";
import {
  addFeedback,
  getConfig,
  removeCustomization,
  renameVersion,
  setActiveVersion,
  activeVersion,
  __resetCache,
} from "./store/agentConfig.js";
import { basePrompt } from "./agents/prompts.js";
import { computeCds } from "./cds/engine.js";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./data/store.js";

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

// Full chart view for the mock EHR (includes any released delta-stage results)
app.get("/api/patients/:id/chart", (req, res) => {
  const rec = getPatient(req.params.id);
  const chart = chartForDisplay(rec);
  res.json({ meta: rec.meta, chart, pending: currentPending(rec), releasedStages: rec.releasedStages });
});

// Serve a Binary resource (PDF bytes or plain text) for the EHR document viewer
app.get("/api/patients/:id/binary/:binaryId", (req, res) => {
  const rec = getPatient(req.params.id);
  const bin = readBinary(rec, req.params.binaryId);
  if (!bin) {
    res.status(404).json({ error: "Binary not found" });
    return;
  }
  if (bin.base64) {
    res.setHeader("Content-Type", bin.contentType);
    res.setHeader("Content-Disposition", "inline");
    res.send(Buffer.from(bin.base64, "base64"));
  } else {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(bin.text ?? "");
  }
});

// Abridge AI CDS — pure rules-matching over the current chart stage. No LLM
// call, so it's instant and reflects the chart even before the narrative
// pre-visit agent has run.
app.get("/api/patients/:id/cds", (req, res) => {
  const rec = getPatient(req.params.id);
  res.json(computeCds(rec));
});

// Records a CDS action as taken so it stays greyed out across window
// close/reopen and time simulation, until the workspace is reset.
app.post("/api/patients/:id/cds-actions", (req, res) => {
  const rec = getPatient(req.params.id);
  const { actionId, confirmation } = req.body ?? {};
  if (!actionId || !confirmation) {
    res.status(400).json({ error: "actionId and confirmation required" });
    return;
  }
  const at = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  rec.sentCdsActions[actionId] = { confirmation, at };
  res.json({ ok: true, sentActions: rec.sentCdsActions });
});

app.get("/api/patients/:id/card", (req, res) => {
  const rec = getPatient(req.params.id);
  // Serverless-friendly: if this instance never ran the agent but a cached run
  // exists, hydrate the card from the recording.
  if (!rec.lastCard && RUN_MODE === "cached") {
    const cached = readRunCache(cacheKey(rec.meta.id, "previsit"));
    if (cached) rec.lastCard = cardFromEvents(cached);
  }
  res.json({ card: rec.lastCard, lastCardAt: rec.lastCardAt, pending: currentPending(rec) });
});

app.post("/api/patients/:id/previsit", (req, res) => {
  const rec = getPatient(req.params.id);
  const run = createRun(rec.meta.id, "previsit", `pv--${rec.meta.id}`);
  startPrevisitRun(run, rec);
  res.json({ runId: run.id });
});

function startPrevisitRun(run: Run, rec: ReturnType<typeof getPatient>): void {
  const cached = RUN_MODE === "cached" ? readRunCache(cacheKey(rec.meta.id, "previsit")) : null;
  // Capture the stage the previsit run actually reviewed. The replay takes
  // several seconds; if the user advances stages (Simulate) while it's still
  // playing, releasedStages will have moved on by the time this resolves —
  // stamping lastDeltaCheckedStage with the CURRENT stage would silently
  // swallow that stage's delta (deltaAvailable would read false with no delta
  // ever having run for it).
  const stageAtStart = rec.releasedStages;
  if (cached && cardFromEvents(cached)) {
    replayRun(run, cached, REPLAY_PREVISIT_MS)
      .then(() => {
        rec.lastCard = cardFromEvents(cached);
        rec.lastCardAt = new Date().toISOString();
        // Monotonic: if a delta triggered by a mid-replay Simulate click has
        // already moved this forward, don't regress it back down.
        rec.lastDeltaCheckedStage = Math.max(rec.lastDeltaCheckedStage, stageAtStart);
      })
      .catch((e) => emit(run, { type: "run_error", message: String(e?.message ?? e), at: Date.now() }));
  } else {
    runPrevisit(run, rec).catch((e) => {
      console.error("previsit run failed", e);
      emit(run, { type: "run_error", message: String(e?.message ?? e), at: Date.now() });
    });
  }
}

app.post("/api/patients/:id/simulate-advance", (req, res) => {
  const rec = getPatient(req.params.id);
  // Serverless-friendly: sync up to the stage the client has already seen
  const known = Number(req.body?.knownStages ?? 0);
  if (known > rec.releasedStages) rec.releasedStages = Math.min(known, rec.events.stages.length);
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
  const known = Number(req.body?.releasedStages ?? 0);
  if (known > rec.releasedStages) rec.releasedStages = Math.min(known, rec.events.stages.length);

  if (!rec.lastCard && RUN_MODE === "cached") {
    const cachedPrevisit = readRunCache(cacheKey(rec.meta.id, "previsit"));
    if (cachedPrevisit) rec.lastCard = cardFromEvents(cachedPrevisit);
  }
  if (!rec.lastCard) {
    res.status(400).json({ error: "Run the pre-visit agent first" });
    return;
  }
  const run = createRun(rec.meta.id, "delta", `dl--${rec.meta.id}--${rec.lastDeltaCheckedStage}--${rec.releasedStages}`);
  startDeltaRun(run, rec);
  res.json({ runId: run.id });
});

function startDeltaRun(run: Run, rec: ReturnType<typeof getPatient>): void {
  const cached =
    RUN_MODE === "cached"
      ? readRunCache(cacheKey(rec.meta.id, "delta", rec.lastDeltaCheckedStage, rec.releasedStages))
      : null;
  if (cached && deltaFromEvents(cached)) {
    replayRun(run, cached, REPLAY_DELTA_MS)
      .then(() => {
        rec.lastDeltaCheckedStage = rec.releasedStages;
      })
      .catch((e) => emit(run, { type: "run_error", message: String(e?.message ?? e), at: Date.now() }));
  } else {
    runDelta(run, rec).catch((e) => {
      console.error("delta run failed", e);
      emit(run, { type: "run_error", message: String(e?.message ?? e), at: Date.now() });
    });
  }
}

/**
 * Reconstruct a run from its id on a cold serverless instance.
 * Run ids are self-describing: pv--<patient>--<n> or dl--<patient>--<from>--<to>--<n>.
 */
function reviveRun(runId: string): Run | null {
  if (RUN_MODE !== "cached") return null;
  const parts = runId.split("--");
  try {
    if (parts[0] === "pv" && parts[1]) {
      const rec = getPatient(parts[1]);
      const run = createRun(rec.meta.id, "previsit", `pv--${rec.meta.id}`, runId);
      startPrevisitRun(run, rec);
      return run;
    }
    if (parts[0] === "dl" && parts[1]) {
      const rec = getPatient(parts[1]);
      rec.lastDeltaCheckedStage = Number(parts[2] ?? 0);
      rec.releasedStages = Math.max(rec.releasedStages, Number(parts[3] ?? 1));
      const run = createRun(rec.meta.id, "delta", "", runId);
      startDeltaRun(run, rec);
      return run;
    }
  } catch {
    return null;
  }
  return null;
}

app.get("/api/runs/:runId/stream", (req, res) => {
  let run = getRun(req.params.runId) ?? reviveRun(req.params.runId);
  if (!run) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);
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
  req.on("close", () => run!.emitter.off("event", listener));
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

// Demo control: restore pristine state (fresh charts, v1.0 prompt config)
app.post("/api/reset", (_req, res) => {
  const cfgPath = path.join(DATA_DIR, "agent-config.json");
  try {
    if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
  } catch {
    // read-only FS (serverless) — in-memory reset below still applies
  }
  resetPatients();
  __resetCache();
  res.json({ ok: true });
});

export default app;
