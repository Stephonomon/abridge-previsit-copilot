import { EventEmitter } from "events";
import type { RunEvent } from "../types.js";

export interface Run {
  id: string;
  patientId: string;
  mode: "previsit" | "delta";
  events: RunEvent[]; // replay buffer for late SSE subscribers
  emitter: EventEmitter;
  done: boolean;
}

const runs = new Map<string, Run>();
let counter = 0;

export function createRun(patientId: string, mode: "previsit" | "delta"): Run {
  const id = `run_${Date.now()}_${++counter}`;
  const run: Run = { id, patientId, mode, events: [], emitter: new EventEmitter(), done: false };
  run.emitter.setMaxListeners(50);
  runs.set(id, run);
  return run;
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

export function emit(run: Run, event: RunEvent): void {
  run.events.push(event);
  if (event.type === "run_complete" || event.type === "run_error") run.done = true;
  run.emitter.emit("event", event);
}
