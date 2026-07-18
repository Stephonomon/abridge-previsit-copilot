import fs from "fs";
import path from "path";
import { DATA_DIR } from "./data/store.js";
import { emit, type Run } from "./events/bus.js";
import type { RunEvent } from "./types.js";

/**
 * Record-and-replay cache. Every successful live run is recorded; in cached
 * mode (PREVISIT_MODE=cached, the default) the demo replays the recorded event
 * stream with compressed pacing so a 60–90s live run plays back in ~10s while
 * still looking like a real multi-agent run.
 */
const CACHE_DIR = path.join(DATA_DIR, "cache");

export function cacheKey(patientId: string, mode: "previsit" | "delta", fromStage = 0, toStage = 0): string {
  return mode === "previsit" ? `${patientId}-previsit` : `${patientId}-delta-s${fromStage}-s${toStage}`;
}

export function writeRunCache(key: string, events: RunEvent[]): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify({ recordedAt: new Date().toISOString(), events }, null, 2));
  } catch (e) {
    console.warn(`run cache not persisted (read-only filesystem?): ${key}`);
  }
}

export function readRunCache(key: string): RunEvent[] | null {
  const p = path.join(CACHE_DIR, `${key}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return (JSON.parse(fs.readFileSync(p, "utf8")) as { events: RunEvent[] }).events;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Replay a recorded run onto a live run's event bus. Inter-event gaps are
 * scaled so the whole run fits in ~targetMs (per-gap capped so nothing stalls),
 * and duration fields are rescaled to match what the viewer experiences.
 */
export async function replayRun(run: Run, recorded: RunEvent[], targetMs: number): Promise<void> {
  if (recorded.length === 0) return;
  const t0 = recorded[0].at;
  const tEnd = recorded[recorded.length - 1].at;
  const originalMs = Math.max(1, tEnd - t0);
  const scale = Math.min(1, targetMs / originalMs);
  const started = Date.now();

  let prevAt = t0;
  for (const original of recorded) {
    const gap = Math.min(900, Math.max(0, (original.at - prevAt) * scale));
    prevAt = original.at;
    if (gap > 0) await sleep(gap);

    const e: RunEvent = { ...original, at: Date.now() };
    if (e.type === "agent_done") e.ms = Math.round(e.ms * scale);
    if (e.type === "run_complete") e.totalMs = Date.now() - started;
    if (e.type === "run_started") {
      (e as any).runId = run.id;
    }
    emit(run, e);
  }
}

export function cardFromEvents(events: RunEvent[]): any | null {
  const e = events.find((x) => x.type === "card_ready") as any;
  return e?.card ?? null;
}

export function deltaFromEvents(events: RunEvent[]): any | null {
  const e = events.find((x) => x.type === "delta_ready") as any;
  return e?.card ?? null;
}
