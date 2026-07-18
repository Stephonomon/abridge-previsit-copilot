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
  triageVitals?: { hr?: number | string; bp?: string; rr?: number; spo2?: number; temp?: number; pain?: number };
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

export interface CdsRibbonTopic {
  topic_id: string;
  title: string;
  matchedCount: number;
  totalRules: number;
  badge: "emergency" | "suspected" | null;
}

export interface CdsActionOrderDetails {
  orderType: string;
  items: string[];
  indication: string;
  priority: string;
}

export interface CdsAction {
  id: string;
  type: "secure_message" | "order";
  label: string;
  recipient?: { name: string; role: string; channel: string };
  template_fill_from_patient?: boolean;
  template?: string;
  orderDetails?: CdsActionOrderDetails;
}

export interface CdsFindingView {
  id: string;
  timestamp: string;
  text: string;
  chart_ref: string;
  chart_label: string;
  matched_rule_id: string;
  weight: string;
  topic_title: string;
}

export interface CdsRecommendationView {
  id: string;
  text: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  evidence_line: string;
  topic_id: string;
  topic_title: string;
  isEmergency: boolean;
  actions: CdsAction[];
  contributingFindings: CdsFindingView[];
  contributingRules: { id: string; finding_pattern: string; why_it_matters: string }[];
}

export interface CdsResult {
  hasCds: boolean;
  asOfTimestamp: string | null;
  ribbon: CdsRibbonTopic[];
  recommendations: CdsRecommendationView[];
  supportingFindings: CdsFindingView[];
  sentActions: Record<string, { confirmation: string; at: string }>;
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
