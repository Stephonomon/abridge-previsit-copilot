export type Severity = "act" | "caution" | "info" | "pending";

export interface SourceRef {
  ref: string;
  label: string;
}

export interface CardItem {
  text: string;
  severity: Severity;
  sources: SourceRef[];
}

export interface CardSection {
  id: string;
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

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: string;
  mrn: string;
  esi: number;
  chiefComplaint: string;
  arrivalLabel: string;
  room: string;
  triageNote: string;
  hasCard: boolean;
  lastCardAt: string | null;
  releasedStages: number;
  totalStages: number;
  nextStageLabel: string | null;
  pending: string[];
  deltaAvailable: boolean;
}

export type RunEvent =
  | { type: "run_started"; runId: string; patientId: string; mode: "previsit" | "delta"; at: number }
  | { type: "agent_started"; agent: string; label: string; at: number }
  | { type: "fhir_call"; agent: string; api: string; params: Record<string, unknown>; resourceCount: number; ms: number; at: number }
  | { type: "agent_done"; agent: string; label: string; findingsCount: number; ms: number; at: number }
  | { type: "synthesis_started"; at: number }
  | { type: "card_ready"; card: RoomEntryCard; at: number }
  | { type: "delta_ready"; card: DeltaCard; at: number }
  | { type: "run_complete"; totalApiCalls: number; totalResources: number; totalMs: number; agentCount: number; at: number }
  | { type: "run_error"; message: string; at: number };

export interface Customization {
  id: string;
  section: string;
  instruction: string;
  createdAt: string;
}

export interface AgentVersion {
  id: string;
  label: string;
  customizations: Customization[];
  createdAt: string;
}

export interface AgentConfigResponse {
  specialty: string;
  agentName: string;
  versions: AgentVersion[];
  activeVersionId: string;
  activeVersion: AgentVersion;
  basePrompt: string;
  deltaPrompt: string;
}
