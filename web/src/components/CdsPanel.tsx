import { useState } from "react";
import type { CdsAction, CdsRecommendationView, CdsResult, Patient } from "../types";
import { ActionModal } from "./ActionModal";

const PRIO_STYLE: Record<string, { chip: string; border: string }> = {
  high: { chip: "text-red-600 border-red-300", border: "border-l-red-500" },
  medium: { chip: "text-amber-600 border-amber-300", border: "border-l-amber-400" },
  low: { chip: "text-stone-500 border-stone-300", border: "border-l-stone-300" },
};

function RecommendationCard({
  rec,
  onTriggerAction,
}: {
  rec: CdsRecommendationView;
  onTriggerAction: (action: CdsAction) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const style = PRIO_STYLE[rec.priority] ?? PRIO_STYLE.low;

  return (
    <div
      className={`rounded-lg border border-stone-200 border-l-4 ${style.border} p-3.5 ${
        rec.isEmergency ? "bg-red-50/60" : "bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[10px] font-bold tracking-wider uppercase border rounded px-1.5 py-0.5 ${style.chip}`}>
          {rec.priority}
        </span>
        {rec.isEmergency && (
          <span className="text-[10px] font-bold tracking-wider uppercase text-white bg-red-600 rounded px-1.5 py-0.5 animate-pulse">
            Surgical Emergency
          </span>
        )}
        <span className="text-[11px] text-stone-400">{rec.topic_title}</span>
      </div>

      <div className="text-[14px] font-semibold leading-snug mb-1.5">{rec.text}</div>
      <div className="text-[12.5px] text-stone-500 leading-relaxed mb-2.5">{rec.rationale}</div>

      {rec.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {rec.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onTriggerAction(action)}
              className="flex items-center gap-1.5 bg-indigo-brand hover:bg-indigo-brand-dark text-white text-xs font-semibold rounded-full px-3.5 py-1.5 shadow-sm"
            >
              {action.type === "secure_message" ? "💬" : "📋"} {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        {rec.contributingFindings.map((f) => (
          <button
            key={f.id}
            onClick={() => setExpanded(expanded === `f-${f.id}` ? null : `f-${f.id}`)}
            className="text-[10.5px] font-mono bg-sky-50 text-sky-700 border border-sky-200 rounded px-1.5 py-0.5 hover:bg-sky-100"
            title={f.text}
          >
            chart: {f.chart_label}
          </button>
        ))}
        {rec.contributingRules.map((r) => (
          <button
            key={r.id}
            onClick={() => setExpanded(expanded === `r-${r.id}` ? null : `r-${r.id}`)}
            className="text-[10.5px] font-mono bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 hover:bg-violet-100"
          >
            rule: {r.id}
          </button>
        ))}
      </div>

      {rec.contributingFindings.map(
        (f) =>
          expanded === `f-${f.id}` && (
            <div key={`open-${f.id}`} className="mt-2 p-2.5 bg-sky-50/60 border-l-2 border-sky-300 text-[12.5px] leading-relaxed rounded-r">
              <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700 mb-1">
                Chart element — {f.chart_label} · {f.timestamp}
              </div>
              {f.text}
            </div>
          )
      )}
      {rec.contributingRules.map(
        (r) =>
          expanded === `r-${r.id}` && (
            <div key={`open-${r.id}`} className="mt-2 p-2.5 bg-violet-50/60 border-l-2 border-violet-300 text-[12.5px] leading-relaxed rounded-r">
              <div className="text-[10px] font-bold uppercase tracking-wide text-violet-700 mb-1">Abridge AI rule — {r.id}</div>
              <div className="font-semibold mb-1">{r.finding_pattern}</div>
              <span className="font-semibold">Why it matters: </span>
              {r.why_it_matters}
            </div>
          )
      )}
    </div>
  );
}

export function CdsPanel({ cds, patient }: { cds: CdsResult | null; patient: Patient }) {
  const [activeAction, setActiveAction] = useState<CdsAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!cds || !cds.hasCds) return null;

  return (
    <div className="rounded-2xl border border-indigo-brand/20 bg-white overflow-hidden shadow-sm relative">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-soft/60 border-b border-indigo-brand/15">
        <span className="w-6 h-6 rounded-md bg-indigo-brand text-white grid place-items-center text-[11px] font-black">AI</span>
        <div className="text-[11px] font-bold tracking-wide uppercase text-indigo-brand-dark">
          Abridge AI consulted{cds.asOfTimestamp ? ` — as of ${cds.asOfTimestamp}` : ""}
        </div>
        <span className="ml-auto text-[10px] font-semibold text-stone-400 bg-stone-100 rounded px-1.5 py-0.5">Synthetic demo</span>
      </div>

      <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-stone-100 bg-stone-50/50">
        {cds.ribbon.map((t) => (
          <div key={t.topic_id} className="flex items-center gap-1.5 text-[12px]">
            <span className="text-stone-400">→</span>
            <span className={`font-bold ${t.badge === "emergency" ? "text-red-600" : "text-indigo-brand-dark"}`}>{t.title}</span>
            <span className="text-stone-400">
              ({t.matchedCount} of {t.totalRules} rules matched)
            </span>
            {t.badge === "emergency" && (
              <span className="text-[9px] font-bold tracking-wider text-white bg-red-600 rounded px-1.5 py-0.5">SURGICAL EMERGENCY</span>
            )}
            {t.badge === "suspected" && (
              <span className="text-[9px] font-bold tracking-wider text-amber-600 border border-amber-400 rounded px-1.5 py-0.5">
                SUSPECTED
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="p-3.5 space-y-2.5">
        {cds.recommendations.length === 0 ? (
          <div className="text-sm text-stone-400 italic px-1 py-2">No recommendations fired for the current findings.</div>
        ) : (
          cds.recommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} onTriggerAction={setActiveAction} />
          ))
        )}
      </div>

      {activeAction && (
        <ActionModal
          action={activeAction}
          patient={patient}
          onClose={() => setActiveAction(null)}
          onSend={(confirmation) => {
            setActiveAction(null);
            setToast(confirmation);
            setTimeout(() => setToast(null), 4200);
          }}
        />
      )}
      {toast && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg z-10">
          {toast}
        </div>
      )}
    </div>
  );
}
