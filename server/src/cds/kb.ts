import fs from "fs";
import path from "path";
import { DATA_DIR } from "../data/store.js";

export interface CdsRule {
  id: string;
  finding_pattern: string;
  why_it_matters: string;
  weight: "high" | "medium" | "low";
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

export interface CdsRecommendation {
  id: string;
  text: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  triggered_by: string[];
  evidence_line: string;
  actions: CdsAction[];
}

export interface CdsTopic {
  topic_id: string;
  title: string;
  rules: CdsRule[];
  recommendations: CdsRecommendation[];
}

export interface CdsFinding {
  id: string;
  stageIndex: number;
  timestamp: string;
  text: string;
  chart_ref: string;
  chart_label: string;
  matched_rule_id: string;
}

export interface PatientCdsFindings {
  topic_ids: string[];
  findings: CdsFinding[];
}

const KB_DIR = path.join(DATA_DIR, "kb");
let topicCache: Map<string, CdsTopic> | null = null;

function loadTopics(): Map<string, CdsTopic> {
  if (topicCache) return topicCache;
  topicCache = new Map();
  if (!fs.existsSync(KB_DIR)) return topicCache;
  for (const file of fs.readdirSync(KB_DIR)) {
    if (!file.endsWith(".json")) continue;
    const topic: CdsTopic = JSON.parse(fs.readFileSync(path.join(KB_DIR, file), "utf8"));
    topicCache.set(topic.topic_id, topic);
  }
  return topicCache;
}

export function getTopic(topicId: string): CdsTopic | undefined {
  return loadTopics().get(topicId);
}

export function getAllTopics(): CdsTopic[] {
  return [...loadTopics().values()];
}

export function getRuleById(ruleId: string): (CdsRule & { topic_id: string; topic_title: string }) | undefined {
  for (const topic of loadTopics().values()) {
    const rule = topic.rules.find((r) => r.id === ruleId);
    if (rule) return { ...rule, topic_id: topic.topic_id, topic_title: topic.title };
  }
  return undefined;
}

export function getRecommendationById(
  recId: string
): (CdsRecommendation & { topic_id: string; topic_title: string }) | undefined {
  for (const topic of loadTopics().values()) {
    const rec = topic.recommendations.find((r) => r.id === recId);
    if (rec) return { ...rec, topic_id: topic.topic_id, topic_title: topic.title };
  }
  return undefined;
}

export function loadPatientCds(patientDir: string): PatientCdsFindings | null {
  const p = path.join(patientDir, "cds.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
