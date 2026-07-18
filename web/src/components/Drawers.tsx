import type { AgentConfigResponse } from "../types";

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-[560px] max-w-full bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center gap-3">
          <div>
            <div className="font-bold">{title}</div>
            {subtitle && <div className="text-xs text-stone-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-stone-100 text-stone-500">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function PromptDrawer({ config, onClose }: { config: AgentConfigResponse; onClose: () => void }) {
  return (
    <Drawer title="Base agent prompt" subtitle="The specialty scaffold this agent runs on — read-only" onClose={onClose}>
      <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Room-Entry Card · prompt v1.0</div>
      <pre className="text-xs font-mono whitespace-pre-wrap bg-stone-50 border border-stone-200 rounded-xl p-4 mb-6">{config.basePrompt}</pre>
      <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Delta Card · prompt v1.0</div>
      <pre className="text-xs font-mono whitespace-pre-wrap bg-stone-50 border border-stone-200 rounded-xl p-4">{config.deltaPrompt}</pre>
    </Drawer>
  );
}

const SECTION_NAMES: Record<string, string> = {
  global: "All sections",
  approach: "Things That Change My Approach",
  meds: "Meds That Matter Now",
  micro_imaging: "Micro & Imaging That Change Empirics",
  ecg_delta: "ECG Delta",
  risk_flags: "One-Liner Risk Flags",
};

export function CustomizationsDrawer({
  config,
  onClose,
  onDelete,
}: {
  config: AgentConfigResponse;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const v = config.activeVersion;
  return (
    <Drawer
      title="Your customizations"
      subtitle={`Layered on top of the base prompt · version ${v.id} (“${v.label}”)`}
      onClose={onClose}
    >
      {v.customizations.length === 0 ? (
        <div className="text-sm text-stone-500">
          No customizations yet on this version. Hover any card section and choose{" "}
          <span className="font-semibold">Teach the agent</span> to add one.
        </div>
      ) : (
        <div className="space-y-3">
          {v.customizations.map((c) => (
            <div key={c.id} className="border border-stone-200 rounded-xl p-4 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[11px] font-semibold text-indigo-brand-dark bg-indigo-soft inline-block rounded-full px-2 py-0.5 mb-2">
                  {SECTION_NAMES[c.section] ?? c.section}
                </div>
                <div className="text-sm">{c.instruction}</div>
              </div>
              <button onClick={() => onDelete(c.id)} className="text-stone-400 hover:text-red-500 p-1" title="Remove">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 text-xs text-stone-400 leading-relaxed">
        Customizations are applied to the next agent run as physician preferences on top of the base specialty prompt. They travel with the
        version selected in the header — keep different versions for different patient populations.
      </div>
    </Drawer>
  );
}
