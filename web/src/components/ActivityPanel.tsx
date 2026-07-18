import type { RunEvent } from "../types";
import { Check, Spinner } from "./icons";

interface AgentGroup {
  key: string;
  label: string;
  status: "working" | "done";
  findings: number | null;
  ms: number | null;
  calls: { api: string; resourceCount: number; ms: number }[];
}

export function groupEvents(events: RunEvent[]): {
  agents: AgentGroup[];
  complete: Extract<RunEvent, { type: "run_complete" }> | null;
  synthesizing: boolean;
  error: string | null;
} {
  const agents: AgentGroup[] = [];
  const byKey = new Map<string, AgentGroup>();
  let complete: Extract<RunEvent, { type: "run_complete" }> | null = null;
  let synthesizing = false;
  let error: string | null = null;
  for (const e of events) {
    if (e.type === "agent_started") {
      const g: AgentGroup = { key: e.agent, label: e.label, status: "working", findings: null, ms: null, calls: [] };
      byKey.set(e.agent, g);
      agents.push(g);
    } else if (e.type === "fhir_call") {
      byKey.get(e.agent)?.calls.push({ api: e.api, resourceCount: e.resourceCount, ms: e.ms });
    } else if (e.type === "agent_done") {
      const g = byKey.get(e.agent);
      if (g) {
        g.status = "done";
        g.findings = e.findingsCount;
        g.ms = e.ms;
      }
    } else if (e.type === "synthesis_started") synthesizing = true;
    else if (e.type === "run_complete") complete = e;
    else if (e.type === "run_error") error = e.message;
  }
  return { agents, complete, synthesizing, error };
}

export function ActivityPanel({ events, mode }: { events: RunEvent[]; mode: "previsit" | "delta" }) {
  const { agents, complete, synthesizing, error } = groupEvents(events);
  const totalCalls = events.filter((e) => e.type === "fhir_call").length;
  const totalResources = events.reduce((s, e) => (e.type === "fhir_call" ? s + e.resourceCount : s), 0);
  const running = !complete && !error;

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)] p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-9 h-9 rounded-full grid place-items-center ${running ? "bg-indigo-soft text-indigo-brand" : "bg-emerald-100 text-emerald-600"}`}>
          {running ? (
            <span className="relative flex">
              <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-indigo-brand opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-brand" />
            </span>
          ) : (
            <svg className="w-4.5 h-4.5 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="font-bold text-[15px]">Live Agent Activity</div>
          <div className="text-xs text-stone-500">
            {error
              ? "Run failed"
              : running
                ? synthesizing
                  ? "Synthesizing card…"
                  : "Sub-agents querying Epic FHIR APIs…"
                : "Run complete"}
          </div>
        </div>
        <div className="text-right text-xs text-stone-500 leading-relaxed">
          <div className="font-semibold text-stone-700">{totalResources} resources</div>
          <div>{totalCalls} API calls{complete ? ` · ${(complete.totalMs / 1000).toFixed(1)}s` : ""}</div>
        </div>
      </div>

      <div className="space-y-3">
        {agents.map((g) => (
          <div
            key={g.key}
            className={`rounded-xl border p-3.5 transition-colors ${
              g.status === "working" ? "border-indigo-brand/60 ring-1 ring-indigo-brand/20 bg-indigo-50/30" : "border-stone-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {g.status === "working" ? (
                <span className="text-indigo-brand">
                  <Spinner />
                </span>
              ) : (
                <span className="text-emerald-500">
                  <Check />
                </span>
              )}
              <span className="font-semibold text-sm">{g.label}</span>
              <span className="ml-auto text-xs text-stone-400">
                {g.status === "working"
                  ? "working"
                  : `${g.findings} finding${g.findings === 1 ? "" : "s"} · ${((g.ms ?? 0) / 1000).toFixed(1)}s`}
              </span>
            </div>
            <div className="space-y-1">
              {g.calls.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono text-stone-600">
                  <span className="text-emerald-500">
                    <Check className="w-3 h-3" />
                  </span>
                  <span className="truncate">{c.api}</span>
                  <span className="ml-auto shrink-0 text-stone-400">
                    {c.resourceCount} res · {c.ms}ms
                  </span>
                </div>
              ))}
              {g.calls.length === 0 && <div className="text-[11px] font-mono text-stone-400">connecting…</div>}
            </div>
          </div>
        ))}
      </div>

      {complete && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 text-sm">
          <span className="font-bold">{mode === "previsit" ? "Chart review complete." : "Delta check complete."}</span>{" "}
          {complete.agentCount} agent{complete.agentCount === 1 ? "" : "s"} read {complete.totalResources} FHIR resources across{" "}
          {complete.totalApiCalls} Epic API calls in {(complete.totalMs / 1000).toFixed(1)} seconds.
        </div>
      )}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-sm">
          <span className="font-bold">Run failed.</span> {error}
        </div>
      )}
    </div>
  );
}
