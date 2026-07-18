import Anthropic from "@anthropic-ai/sdk";
import { MODEL, SUBAGENT_EFFORT } from "../env.js";
import { BINARY_READ_EXTERNAL, OPERATIONS_BY_TOOL, jitteredLatency } from "../fhir/operations.js";
import { readBinary, type PatientRecord } from "../data/store.js";
import { emit, type Run } from "../events/bus.js";
import type { SubagentResult } from "../types.js";

const client = new Anthropic();

const FINDINGS_SCHEMA = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            finding: { type: "string", description: "The chart fact, stated tersely, clinician-to-clinician, with values and dates" },
            clinicalRelevance: { type: "string", description: "Why this could change management for TODAY'S presentation (one line)" },
            source: {
              type: "object",
              properties: {
                ref: { type: "string", description: "FHIR resource id or Binary id this fact came from" },
                label: { type: "string", description: "Short human label, e.g. 'hs-Troponin 6/28' or 'Cardiology note 3/14'" },
              },
              required: ["ref", "label"],
              additionalProperties: false,
            },
          },
          required: ["finding", "clinicalRelevance", "source"],
          additionalProperties: false,
        },
      },
      dataGaps: { type: "array", items: { type: "string" }, description: "Required data types that were absent, e.g. 'No prior ECG available'" },
    },
    required: ["findings", "dataGaps"],
    additionalProperties: false,
  },
};

export interface SubagentSpec {
  key: string; // e.g. "results"
  label: string; // e.g. "Results Agent"
  toolNames: string[]; // FHIR operations this agent may call
  includeDocumentReader?: boolean; // enables Binary.Read (External CCDA) with PDF attachment
  systemPrompt: string;
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: any;
}

function toolDefs(spec: SubagentSpec): ToolDef[] {
  const defs: ToolDef[] = spec.toolNames.map((t) => {
    const op = OPERATIONS_BY_TOOL.get(t);
    if (!op) throw new Error(`Unknown FHIR op: ${t}`);
    return { name: op.toolName, description: `Epic API: ${op.apiName}. ${op.description}`, input_schema: op.inputSchema };
  });
  if (spec.includeDocumentReader) {
    defs.push({
      name: BINARY_READ_EXTERNAL.toolName,
      description: `Epic API: ${BINARY_READ_EXTERNAL.apiName}. ${BINARY_READ_EXTERNAL.description}`,
      input_schema: BINARY_READ_EXTERNAL.inputSchema,
    });
  }
  return defs;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs one domain sub-agent: a Claude tool-use loop over its scoped subset of
 * mock Epic FHIR operations, returning structured findings. Every FHIR call is
 * emitted to the run's event bus for the Live Agent Activity panel.
 */
export async function runSubagent(run: Run, rec: PatientRecord, spec: SubagentSpec): Promise<SubagentResult> {
  const started = Date.now();
  emit(run, { type: "agent_started", agent: spec.key, label: spec.label, at: started });

  const tools = toolDefs(spec);
  const patientContext = `Patient: ${rec.meta.name}, ${rec.meta.age}${rec.meta.sex}, MRN ${rec.meta.mrn}. ED arrival ${rec.meta.arrivalLabel} today (${rec.meta.arrivalTime.slice(0, 10)}). CC: ${rec.meta.chiefComplaint}. ESI ${rec.meta.esi}. Triage note: ${rec.meta.triageNote} Triage vitals: ${JSON.stringify(rec.meta.triageVitals)}.`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `${patientContext}\n\nQuery the Epic FHIR APIs available to you to review your assigned slice of this chart. Be efficient: call each relevant API (you may call several in parallel), read what matters, then produce your structured findings. Today's date is 2026-07-18.`,
    },
  ];

  let apiCalls = 0;
  for (let round = 0; round < 6; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: spec.systemPrompt,
      output_config: { effort: SUBAGENT_EFFORT as any, format: round >= 5 ? FINDINGS_SCHEMA : undefined },
      tools: tools as any,
      messages,
    });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
      // Final structured answer expected. If not valid JSON, force one more structured call.
      const text = response.content.filter((b) => b.type === "text").map((b: any) => b.text).join("");
      try {
        const parsed = JSON.parse(text);
        const result: SubagentResult = { agent: spec.key, findings: parsed.findings ?? [], dataGaps: parsed.dataGaps ?? [] };
        emit(run, { type: "agent_done", agent: spec.key, label: spec.label, findingsCount: result.findings.length, ms: Date.now() - started, at: Date.now() });
        return result;
      } catch {
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: "Now emit your findings as JSON only." });
        const final = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: spec.systemPrompt,
          output_config: { effort: SUBAGENT_EFFORT as any, format: FINDINGS_SCHEMA },
          messages,
        });
        const finalText = final.content.filter((b) => b.type === "text").map((b: any) => b.text).join("");
        const parsed = JSON.parse(finalText);
        const result: SubagentResult = { agent: spec.key, findings: parsed.findings ?? [], dataGaps: parsed.dataGaps ?? [] };
        emit(run, { type: "agent_done", agent: spec.key, label: spec.label, findingsCount: result.findings.length, ms: Date.now() - started, at: Date.now() });
        return result;
      }
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const latency = jitteredLatency();
      await sleep(latency);
      apiCalls++;

      if (tu.name === BINARY_READ_EXTERNAL.toolName) {
        const binaryId = String((tu.input as any).binaryId ?? "").replace(/^Binary\//, "");
        const bin = readBinary(rec, binaryId);
        emit(run, {
          type: "fhir_call",
          agent: spec.key,
          api: BINARY_READ_EXTERNAL.apiName,
          params: { binaryId },
          resourceCount: bin ? 1 : 0,
          ms: latency,
          at: Date.now(),
        });
        if (bin?.base64) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: bin.base64 } } as any,
              { type: "text", text: `Binary ${binaryId} attached above as PDF. Cite ref "${binaryId}".` },
            ],
          });
        } else if (bin?.text) {
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: bin.text });
        } else {
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: `No Binary found with id ${binaryId}`, is_error: true });
        }
        continue;
      }

      const op = OPERATIONS_BY_TOOL.get(tu.name);
      if (!op) {
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: `Unknown API ${tu.name}`, is_error: true });
        continue;
      }
      const resources = op.run(rec, (tu.input as any) ?? {});
      emit(run, {
        type: "fhir_call",
        agent: spec.key,
        api: op.apiName,
        params: (tu.input as any) ?? {},
        resourceCount: resources.length,
        ms: latency,
        at: Date.now(),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify({ resourceType: "Bundle", total: resources.length, entry: resources }),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Ran out of rounds — force a structured wrap-up
  messages.push({ role: "user", content: "Stop querying. Emit your findings now as JSON." });
  const final = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: spec.systemPrompt,
    output_config: { effort: SUBAGENT_EFFORT as any, format: FINDINGS_SCHEMA },
    messages,
  });
  const text = final.content.filter((b) => b.type === "text").map((b: any) => b.text).join("");
  const parsed = JSON.parse(text);
  const result: SubagentResult = { agent: spec.key, findings: parsed.findings ?? [], dataGaps: parsed.dataGaps ?? [] };
  emit(run, { type: "agent_done", agent: spec.key, label: spec.label, findingsCount: result.findings.length, ms: Date.now() - started, at: Date.now() });
  return result;
}
