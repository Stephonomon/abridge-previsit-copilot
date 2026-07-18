// Top-level chrome for the mock EHR — deliberately utilitarian, NOT the copilot aesthetic.
import { useState } from "react";

export function EhrTopBar({
  tabTitle,
  onHome,
  onResetWorkspace,
}: {
  tabTitle?: string;
  onHome: () => void;
  onResetWorkspace: () => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);

  return (
    <div className="bg-[#155676] text-white">
      <div className="flex items-center gap-4 px-3 py-1.5 text-[13px]">
        <button onClick={onHome} className="flex items-center gap-2 font-bold text-[15px] tracking-tight">
          <span className="bg-white text-[#155676] rounded px-1.5 py-0.5 text-xs font-black">MH</span>
          Meridian <span className="font-normal opacity-80">Hyperdrive — ED</span>
        </button>
        <nav className="flex items-center gap-3 opacity-90">
          <button onClick={onHome} className="hover:underline">ED Chart</button>
          <span className="cursor-default opacity-60">In Basket</span>
          <span className="cursor-default opacity-60">My Reports</span>
          <span className="cursor-default opacity-60">On-Call Finder</span>
        </nav>
        <div className="flex-1 max-w-md mx-auto">
          <div className="bg-white/15 border border-white/25 rounded-full px-3 py-1 text-xs text-white/70">
            Search (Ctrl+Space)
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-xs">
          <button
            onClick={async () => {
              setResetting(true);
              await onResetWorkspace();
              window.location.reload();
            }}
            disabled={resetting}
            title="Reset demo workspace — clears all patients back to arrival state"
            className="p-1.5 rounded-full hover:bg-white/15 disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${resetting ? "animate-spin" : ""}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
          <span className="opacity-80">MERIDIAN EMERGENCY</span>
          <span className="w-7 h-7 rounded-full bg-rose-400 text-white grid place-items-center font-bold">JL</span>
        </div>
      </div>
      {tabTitle && (
        <div className="bg-[#e8eef2] text-stone-800 flex items-center text-[12px] border-b border-stone-300">
          <button onClick={onHome} className="px-3 py-1 border-r border-stone-300 hover:bg-white">⌂</button>
          <span className="px-3 py-1 bg-white border-r border-stone-300 font-semibold flex items-center gap-2">
            {tabTitle}
            <button onClick={onHome} className="text-stone-400 hover:text-stone-700">✕</button>
          </span>
        </div>
      )}
    </div>
  );
}
