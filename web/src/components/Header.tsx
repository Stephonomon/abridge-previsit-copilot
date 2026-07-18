import type { AgentConfigResponse } from "../types";
import { Eye, Sliders, Stethoscope } from "./icons";

export function Header({
  config,
  onShowPrompt,
  onShowCustomizations,
  onShowVersions,
}: {
  config: AgentConfigResponse | null;
  onShowPrompt: () => void;
  onShowCustomizations: () => void;
  onShowVersions: () => void;
}) {
  const customizationCount = config?.activeVersion?.customizations.length ?? 0;
  return (
    <header className="bg-white/80 backdrop-blur border-b border-stone-200 sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-brand text-white grid place-items-center shadow-sm">
            <Stethoscope />
          </div>
          <div>
            <div className="font-bold text-[15px] leading-tight">Pre-Visit Copilot</div>
            <div className="text-xs text-stone-500">Specialty chart intelligence</div>
          </div>
        </div>

        <nav className="flex items-center gap-1 text-sm font-medium">
          <span className="px-4 py-1.5 rounded-full bg-indigo-soft text-indigo-brand-dark">Emergency Medicine</span>
        </nav>

        <div className="ml-auto flex items-center gap-2 bg-white border border-stone-200 rounded-full pl-4 pr-2 py-1.5 shadow-sm">
          <span className="text-sm font-semibold">{config?.agentName ?? "EM Chart-Review Copilot"}</span>
          <button
            onClick={onShowVersions}
            className="text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-2.5 py-1 flex items-center gap-1"
            title="Agent versions"
          >
            {config?.activeVersionId ?? "v1.0"}
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9.5 12 15l6-5.5" />
            </svg>
          </button>
          <div className="w-px h-5 bg-stone-200 mx-1" />
          <button onClick={onShowPrompt} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600" title="View base agent prompt">
            <Eye />
          </button>
          <button
            onClick={onShowCustomizations}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600 relative"
            title="Your customizations"
          >
            <Sliders />
            {customizationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-indigo-brand text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 grid place-items-center">
                {customizationCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
