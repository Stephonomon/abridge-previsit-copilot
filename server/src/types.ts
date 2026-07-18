export type Severity = "act" | "caution" | "info" | "pending";

export interface SourceRef {
  ref: string; // FHIR resource id or document id
  label: string; // e.g. "hs-Troponin 6/28/2026" or "EMS run sheet (PDF)"
}

export interface CardItem {
  text: string;
  severity: Severity;
  sources: SourceRef[];
}

export interface CardSection {
  id: "approach" | "meds" | "micro_imaging" | "ecg_delta" | "risk_flags";
  title: string;
  items: CardItem[];
}

export interface RoomEntryCard {
  oneLiner: string;
  sections: CardSection[];
}

export interface DeltaItem {
  flag: "ACT" | "NOTE";
  text: string;
  prior: string | null;
  current: string;
  why: string;
  source: string;
}

export interface DeltaCard {
  noDelta: boolean;
  items: DeltaItem[];
  interactionCheck: string | null;
  pending: string[];
  overflowNote: string | null;
}

export interface SubagentFinding {
  finding: string;
  clinicalRelevance: string;
  source: SourceRef;
}

export interface SubagentResult {
  agent: string;
  findings: SubagentFinding[];
  dataGaps: string[];
}

// ---- Run/telemetry events streamed to the UI ----
export type RunEvent =
  | { type: "run_started"; runId: string; patientId: string; mode: "previsit" | "delta"; at: number }
  | { type: "agent_started"; agent: string; label: string; at: number }
  | {
      type: "fhir_call";
      agent: string;
      api: string; // full Epic API name e.g. "Observation.Search (Labs) (R4)"
      params: Record<string, unknown>;
      resourceCount: number;
      ms: number;
      at: number;
    }
  | { type: "agent_done"; agent: string; label: string; findingsCount: number; ms: number; at: number }
  | { type: "synthesis_started"; at: number }
  | { type: "card_ready"; card: RoomEntryCard; at: number }
  | { type: "delta_ready"; card: DeltaCard; at: number }
  | {
      type: "run_complete";
      totalApiCalls: number;
      totalResources: number;
      totalMs: number;
      agentCount: number;
      at: number;
    }
  | { type: "run_error"; message: string; at: number };

// ---- Agent config / prompt versioning ----
export interface Customization {
  id: string;
  section: string; // card section id or "global"
  instruction: string;
  createdAt: string;
}

export interface AgentVersion {
  id: string; // "v1.0", "v1.1", ...
  label: string;
  customizations: Customization[];
  createdAt: string;
}

export interface AgentConfig {
  specialty: string;
  agentName: string;
  basePromptFile: string;
  deltaPromptFile: string;
  versions: AgentVersion[];
  activeVersionId: string;
}
