import Anthropic from "@anthropic-ai/sdk";
import { MODEL, SYNTHESIS_EFFORT } from "../env.js";
import { emit, type Run } from "../events/bus.js";
import { currentPending, type PatientRecord } from "../data/store.js";
import { composedPrompt } from "./prompts.js";
import { runSubagent, type SubagentSpec } from "./subagent.js";
import { cacheKey, writeRunCache } from "../cache.js";
import type { RoomEntryCard, SubagentResult } from "../types.js";

const client = new Anthropic();

const SHARED_RULES = `You are a chart-review sub-agent inside an ED pre-visit intelligence system. You do NOT talk to the physician — you feed findings to a synthesis agent. Rules: surface only facts that could plausibly change management for TODAY'S chief complaint; skip normals unless they are clinically relevant negatives (e.g. negative serial troponins with chest pain); always carry exact values, units, and dates; every finding cites the FHIR resource id it came from; note explicit data gaps for anything your domain should contain but doesn't. No speculation — documented facts only.`;

export const SUBAGENT_SPECS: SubagentSpec[] = [
  {
    key: "chart-overview",
    label: "Chart Overview Agent",
    toolNames: [
      "Patient_Read_Demographics",
      "Appointment_Read_Appointments",
      "Encounter_Search_PatientChart",
      "Coverage_Search_Insurance",
      "Procedure_Search_Orders",
    ],
    systemPrompt: `${SHARED_RULES}\n\nYour domain: demographics, today's arrival context (CC, ESI, triage note/vitals), prior encounters over the last 12 months (titles + dispo diagnoses — flag repeat visits for the same complaint), surgical history, and insurance only if it affects disposition.`,
  },
  {
    key: "meds-problems",
    label: "Meds & Problems Agent",
    toolNames: [
      "Condition_Search_Problems",
      "MedicationRequest_Search_Signed",
      "AllergyIntolerance_Search",
      "Condition_Search_MedicalHistory",
    ],
    systemPrompt: `${SHARED_RULES}\n\nYour domain: active problem list, active medications (filter to those relevant to today's CC or empiric treatment: anticoagulants/antiplatelets, AV-nodal blockers, immunosuppressants, insulin/sulfonylureas, QT-prolonging agents, meds whose adverse effects could mimic/worsen the CC), medications given this visit, allergies with criticality, and relevant medical history.`,
  },
  {
    key: "results",
    label: "Results Agent",
    toolNames: [
      "Observation_Search_Labs",
      "Observation_Search_VitalSigns",
      "DiagnosticReport_Search_Results",
      "DocumentReference_Search_Radiology",
      "Observation_Search_Assessments",
    ],
    systemPrompt: `${SHARED_RULES}\n\nYour domain: labs (with trends — always give prior values, e.g. "hs-trop 8→9"), vital sign trends, ECG reports (compare most recent to prior — flag LBBB/RBBB, interval changes, QTc, ischemic patterns), imaging reads, echo results, and microbiology with sensitivities (flag MDR organisms and whether standard empirics would miss them).`,
  },
  {
    key: "notes-context",
    label: "Notes & Context Agent",
    toolNames: [
      "DocumentReference_Search_ClinicalNotes",
      "Observation_Search_SocialHistory",
      "FamilyMemberHistory_Search",
      "Binary_Read_ClinicalNotes",
    ],
    systemPrompt: `${SHARED_RULES}\n\nYour domain: clinical note text (read the actual notes via Binary.Read — specialist assessments, discharge plans, follow-up that did or didn't happen, code status if documented), social history (smoking, alcohol, living situation, high-risk social factors), and family history relevant to today's CC.`,
  },
  {
    key: "documents",
    label: "Document Intelligence Agent",
    toolNames: ["DocumentReference_Search_ExternalCCDA"],
    includeDocumentReader: true,
    systemPrompt: `${SHARED_RULES}\n\nYour domain: OUTSIDE documents buried in the chart — faxed consult letters, EMS run sheets, outside imaging/stress reports, transferred records. These are usually PDFs. Search for external documents, then READ EVERY PDF with Binary.Read — critical facts hide in faxes that structured data misses (med changes, outside test results, statements the patient made to EMS). Extract anything that changes management today and cite the document.`,
  },
];

const CARD_SCHEMA = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      oneLiner: { type: "string", description: "The One-Line Frame per the card spec" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["approach", "meds", "micro_imaging", "ecg_delta", "risk_flags"] },
            title: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  severity: { type: "string", enum: ["act", "caution", "info", "pending"] },
                  sources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { ref: { type: "string" }, label: { type: "string" } },
                      required: ["ref", "label"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["text", "severity", "sources"],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "title", "items"],
          additionalProperties: false,
        },
      },
    },
    required: ["oneLiner", "sections"],
    additionalProperties: false,
  },
};

export async function runPrevisit(run: Run, rec: PatientRecord): Promise<RoomEntryCard> {
  const t0 = Date.now();
  // Stage the run actually reviewed — if the patient advances stages while
  // this (multi-second) run is still in flight, releasedStages will have
  // moved on by the time we finish; stamping lastDeltaCheckedStage with the
  // stage at completion would silently swallow the delta for those stages.
  const stageAtStart = rec.releasedStages;
  emit(run, { type: "run_started", runId: run.id, patientId: rec.meta.id, mode: "previsit", at: t0 });

  const results: SubagentResult[] = await Promise.all(
    SUBAGENT_SPECS.map((spec) => runSubagent(run, rec, spec))
  );

  emit(run, { type: "synthesis_started", at: Date.now() });

  const { prompt } = composedPrompt("emergency-medicine", "previsit");
  const synthesisSystem = `${prompt}

---

## Output contract (for this system)

You will receive structured findings from 5 chart-review sub-agents. Synthesize them into the card defined above, as JSON matching the provided schema.

- Section ids: approach = "Things That Change My Approach", meds = "Meds That Matter Now", micro_imaging = "Micro & Imaging That Change Empirics", ecg_delta = "ECG Delta", risk_flags = "One-Liner Risk Flags".
- severity: "act" = plausibly changes management immediately; "caution" = modifies decisions/dosing; "info" = context the physician should know; "pending" = not yet resulted for today's visit.
- Every item carries its source refs (copy from the sub-agent findings; merge duplicates and combine their sources).
- Honor every Hard Rule, including flagging data gaps as items ("No [X] available") and the max-item limits per section.`;

  const findingsPayload = {
    patient: {
      name: rec.meta.name,
      age: rec.meta.age,
      sex: rec.meta.sex,
      mrn: rec.meta.mrn,
      esi: rec.meta.esi,
      chiefComplaint: rec.meta.chiefComplaint,
      triageNote: rec.meta.triageNote,
      triageVitals: rec.meta.triageVitals,
    },
    pendingOrders: currentPending(rec),
    subagentFindings: results,
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: synthesisSystem,
    output_config: { effort: SYNTHESIS_EFFORT as any, format: CARD_SCHEMA },
    messages: [{ role: "user", content: JSON.stringify(findingsPayload) }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b: any) => b.text).join("");
  const card: RoomEntryCard = JSON.parse(text);

  const fhirCalls = run.events.filter((e) => e.type === "fhir_call") as Extract<
    (typeof run.events)[number],
    { type: "fhir_call" }
  >[];
  emit(run, { type: "card_ready", card, at: Date.now() });
  emit(run, {
    type: "run_complete",
    totalApiCalls: fhirCalls.length,
    totalResources: fhirCalls.reduce((s, e) => s + e.resourceCount, 0),
    totalMs: Date.now() - t0,
    agentCount: SUBAGENT_SPECS.length,
    at: Date.now(),
  });

  rec.lastCard = card;
  rec.lastCardAt = new Date().toISOString();
  // Monotonic: if a delta triggered by a mid-run Simulate click has already
  // moved this forward, don't regress it back down.
  rec.lastDeltaCheckedStage = Math.max(rec.lastDeltaCheckedStage, stageAtStart);
  writeRunCache(cacheKey(rec.meta.id, "previsit"), run.events);
  return card;
}
