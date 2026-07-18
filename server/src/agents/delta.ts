import Anthropic from "@anthropic-ai/sdk";
import { MODEL, SYNTHESIS_EFFORT } from "../env.js";
import { emit, type Run } from "../events/bus.js";
import { currentPending, readBinary, stagesBetween, type PatientRecord } from "../data/store.js";
import { composedPrompt } from "./prompts.js";
import { jitteredLatency } from "../fhir/operations.js";
import type { DeltaCard } from "../types.js";

const client = new Anthropic();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DELTA_SCHEMA = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      noDelta: { type: "boolean", description: "true if NO new events qualify as delta items" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            flag: { type: "string", enum: ["ACT", "NOTE"] },
            text: { type: "string", description: "The finding, e.g. 'hs-Troponin T resulted 62 ng/L'" },
            prior: { anyOf: [{ type: "string" }, { type: "null" }], description: "Prior value/state, or null if no prior" },
            current: { type: "string", description: "New value/state" },
            why: { type: "string", description: "Why it matters now, <= 1 line" },
            source: { type: "string", description: "Source ref (resource/document id + short label)" },
          },
          required: ["flag", "text", "prior", "current", "why", "source"],
          additionalProperties: false,
        },
      },
      interactionCheck: { anyOf: [{ type: "string" }, { type: "null" }], description: "One-line interaction warning if triggered, else null" },
      pending: { type: "array", items: { type: "string" } },
      overflowNote: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
    required: ["noDelta", "items", "interactionCheck", "pending", "overflowNote"],
    additionalProperties: false,
  },
};

/**
 * Delta agent: fetches everything resulted since the last card and produces
 * the interruption-budgeted Delta Card. Telemetry mirrors the FHIR fetches the
 * agent performs over the newly released stages.
 */
export async function runDelta(run: Run, rec: PatientRecord): Promise<DeltaCard> {
  const t0 = Date.now();
  emit(run, { type: "run_started", runId: run.id, patientId: rec.meta.id, mode: "delta", at: t0 });
  emit(run, { type: "agent_started", agent: "delta", label: "Delta Agent", at: t0 });

  const stages = stagesBetween(rec, rec.lastDeltaCheckedStage, rec.releasedStages);

  const newLabs = stages.flatMap((s) => s.newObservationsLabs ?? []);
  const newVitals = stages.flatMap((s) => s.newObservationsVitals ?? []);
  const newReports = stages.flatMap((s) => s.newDiagnosticReports ?? []);
  const newDocs = stages.flatMap((s) => s.newDocuments ?? []);

  // Emit telemetry for the "fetch new results" API sweep
  const sweeps: [string, number][] = [
    ["Observation.Search (Labs) (R4)", newLabs.length],
    ["Observation.Search (Vital Signs) (R4)", newVitals.length],
    ["DiagnosticReport.Search (Results) (R4)", newReports.length],
    ["DocumentReference.Search (External CCDA) (R4)", newDocs.length],
  ];
  for (const [api, count] of sweeps) {
    const ms = jitteredLatency();
    await sleep(ms / 2);
    emit(run, { type: "fhir_call", agent: "delta", api, params: { sinceLastCard: true }, resourceCount: count, ms, at: Date.now() });
  }

  // Attach any newly arrived PDFs so the delta agent can mine them too
  const pdfBlocks: any[] = [];
  for (const doc of newDocs) {
    const bin = readBinary(rec, doc.binaryId);
    if (bin?.base64) {
      const ms = jitteredLatency();
      emit(run, { type: "fhir_call", agent: "delta", api: "Binary.Read (External CCDA) (R4)", params: { binaryId: doc.binaryId }, resourceCount: 1, ms, at: Date.now() });
      pdfBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: bin.base64 } });
      pdfBlocks.push({ type: "text", text: `^ Newly arrived document "${doc.documentReference.description ?? doc.binaryId}" (ref ${doc.binaryId})` });
    }
  }

  const { prompt } = composedPrompt("emergency-medicine", "delta");
  const system = `${prompt}\n\n---\n\n## Output contract (for this system)\n\nRespond as JSON matching the provided schema. Items follow the card structure: flag, finding text, prior → current, why it matters (one line), source ref. Use noDelta=true with empty items for the no-delta state. Max 3 items; if more qualify, keep the 3 most disposition-relevant and set overflowNote.`;

  const payload = {
    chiefComplaint: rec.meta.chiefComplaint,
    triageContext: rec.meta.triageNote,
    priorRoomEntryCard: rec.lastCard,
    newEventsSinceLastCard: { labs: newLabs, vitals: newVitals, reports: newReports, documents: newDocs.map((d) => d.documentReference) },
    stillPending: currentPending(rec),
    now: new Date().toISOString(),
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    output_config: { effort: SYNTHESIS_EFFORT as any, format: DELTA_SCHEMA },
    messages: [
      {
        role: "user",
        content: [
          ...pdfBlocks,
          { type: "text", text: JSON.stringify(payload) },
        ],
      },
    ],
  });

  const text = response.content.filter((b) => b.type === "text").map((b: any) => b.text).join("");
  const card: DeltaCard = JSON.parse(text);

  emit(run, { type: "agent_done", agent: "delta", label: "Delta Agent", findingsCount: card.items.length, ms: Date.now() - t0, at: Date.now() });
  const fhirCalls = run.events.filter((e) => e.type === "fhir_call") as any[];
  emit(run, { type: "delta_ready", card, at: Date.now() });
  emit(run, {
    type: "run_complete",
    totalApiCalls: fhirCalls.length,
    totalResources: fhirCalls.reduce((s: number, e: any) => s + e.resourceCount, 0),
    totalMs: Date.now() - t0,
    agentCount: 1,
    at: Date.now(),
  });

  rec.lastDeltaCheckedStage = rec.releasedStages;
  return card;
}
