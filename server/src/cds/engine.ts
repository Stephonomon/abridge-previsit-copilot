import { getRuleById, getTopic, loadPatientCds, type CdsFinding } from "./kb.js";
import type { PatientRecord } from "../data/store.js";

const WEIGHT_ORDER = { high: 0, medium: 1, low: 2 } as const;

export interface CdsRibbonTopic {
  topic_id: string;
  title: string;
  matchedCount: number;
  totalRules: number;
  badge: "emergency" | "suspected" | null;
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
  actions: any[];
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

/**
 * Computes the fired Abridge AI recommendations for a patient at their current
 * stage (rec.releasedStages). Pure rules-matching over pre-authored findings —
 * no LLM call, so it's instant and works even before the narrative agent runs.
 */
export function computeCds(rec: PatientRecord): CdsResult {
  const sentActions = rec.sentCdsActions ?? {};
  const patientCds = loadPatientCds(rec.dir);
  if (!patientCds) return { hasCds: false, asOfTimestamp: null, ribbon: [], recommendations: [], supportingFindings: [], sentActions };

  const currentStage = rec.releasedStages; // 0 = arrival, 1 = after 1st simulate, ...
  const visible: CdsFinding[] = patientCds.findings.filter((f) => f.stageIndex <= currentStage);
  if (visible.length === 0) return { hasCds: true, asOfTimestamp: null, ribbon: [], recommendations: [], supportingFindings: [], sentActions };

  const asOfTimestamp = visible[visible.length - 1]?.timestamp ?? null;
  const matchedRuleIds = new Set(visible.map((f) => f.matched_rule_id));

  const dissectionConfirmed = matchedRuleIds.has("ad-r1");
  const dissectionSuspected = matchedRuleIds.has("ad-r5");

  // ---- Ribbon: topics consulted ----
  const ribbon: CdsRibbonTopic[] = [];
  for (const topicId of patientCds.topic_ids) {
    const topic = getTopic(topicId);
    if (!topic) continue;
    const matchedInTopic = topic.rules.filter((r) => matchedRuleIds.has(r.id));
    if (matchedInTopic.length === 0) continue; // not consulted yet at this stage
    let badge: CdsRibbonTopic["badge"] = null;
    if (topicId === "aortic-dissection") badge = dissectionConfirmed ? "emergency" : dissectionSuspected ? "suspected" : null;
    ribbon.push({ topic_id: topic.topic_id, title: topic.title, matchedCount: matchedInTopic.length, totalRules: topic.rules.length, badge });
  }
  // Emergency topics float to the top of the ribbon
  ribbon.sort((a, b) => (a.badge === "emergency" ? -1 : 0) - (b.badge === "emergency" ? -1 : 0));

  // ---- Findings (view shape, sorted: dissection topic first, then by weight) ----
  const findingView = (f: CdsFinding): CdsFindingView | null => {
    const rule = getRuleById(f.matched_rule_id);
    if (!rule) return null;
    return {
      id: f.id,
      timestamp: f.timestamp,
      text: f.text,
      chart_ref: f.chart_ref,
      chart_label: f.chart_label,
      matched_rule_id: f.matched_rule_id,
      weight: rule.weight,
      topic_title: rule.topic_title,
    };
  };
  const supportingFindings = visible
    .map(findingView)
    .filter((f): f is CdsFindingView => !!f)
    .sort((a, b) => {
      const topicPriority = (rid: string) => (getRuleById(rid)?.topic_id === "aortic-dissection" ? 0 : 1);
      const dp = topicPriority(a.matched_rule_id) - topicPriority(b.matched_rule_id);
      if (dp !== 0) return dp;
      return WEIGHT_ORDER[a.weight as keyof typeof WEIGHT_ORDER] - WEIGHT_ORDER[b.weight as keyof typeof WEIGHT_ORDER];
    });

  // ---- Fired recommendations ----
  // Track each recommendation's freshest contributing finding (by stage) so
  // recs superseded by later evidence (e.g. "get a CT" once the CT is back
  // and confirms the diagnosis) sort below the newer recs, not above them.
  const staged: { view: CdsRecommendationView; maxStageIndex: number }[] = [];
  for (const topicId of patientCds.topic_ids) {
    const topic = getTopic(topicId);
    if (!topic) continue;
    for (const recDef of topic.recommendations) {
      const fired = recDef.triggered_by.some((rid) => matchedRuleIds.has(rid));
      if (!fired) continue;
      const matchingFindings = recDef.triggered_by.flatMap((rid) => visible.filter((f) => f.matched_rule_id === rid));
      const contributingFindings = matchingFindings.map(findingView).filter((f): f is CdsFindingView => !!f);
      const contributingRules = recDef.triggered_by
        .filter((rid) => matchedRuleIds.has(rid))
        .map((rid) => {
          const r = topic.rules.find((x) => x.id === rid);
          return r ? { id: r.id, finding_pattern: r.finding_pattern, why_it_matters: r.why_it_matters } : null;
        })
        .filter((r): r is { id: string; finding_pattern: string; why_it_matters: string } => !!r);
      const maxStageIndex = matchingFindings.reduce((max, f) => Math.max(max, f.stageIndex), 0);
      staged.push({
        maxStageIndex,
        view: {
          id: recDef.id,
          text: recDef.text,
          rationale: recDef.rationale,
          priority: recDef.priority,
          evidence_line: recDef.evidence_line,
          topic_id: topic.topic_id,
          topic_title: topic.title,
          isEmergency: topic.topic_id === "aortic-dissection" && dissectionConfirmed && recDef.priority === "high",
          actions: recDef.actions ?? [],
          contributingFindings,
          contributingRules,
        },
      });
    }
  }

  staged.sort((a, b) => {
    if (a.view.isEmergency !== b.view.isEmergency) return a.view.isEmergency ? -1 : 1;
    const wp = WEIGHT_ORDER[a.view.priority] - WEIGHT_ORDER[b.view.priority];
    if (wp !== 0) return wp;
    return b.maxStageIndex - a.maxStageIndex; // freshest evidence first
  });
  const recommendations = staged.map((s) => s.view);

  return { hasCds: true, asOfTimestamp, ribbon, recommendations, supportingFindings, sentActions };
}
