import type { DeltaCard } from "../types";

export function DeltaCardView({ card, stageLabel }: { card: DeltaCard; stageLabel: string | null }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)] overflow-hidden border-l-4 border-indigo-brand">
      <div className="px-6 pt-5 pb-3 flex items-center gap-3">
        <div className="font-bold text-[15px]">Delta Card</div>
        {stageLabel && <div className="text-xs text-stone-500">{stageLabel}</div>}
        <div className="ml-auto text-[11px] font-semibold text-indigo-brand-dark bg-indigo-soft rounded-full px-2.5 py-1">
          Mid-encounter update
        </div>
      </div>

      <div className="px-6 pb-5 space-y-3">
        {card.noDelta ? (
          <div className="text-[15px] font-medium text-stone-700">No management-changing results since last review.</div>
        ) : (
          card.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className={`shrink-0 text-[11px] font-bold rounded-md px-2 py-0.5 mt-0.5 ${
                  item.flag === "ACT" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700"
                }`}
              >
                {item.flag}
              </span>
              <div className="text-[15px] leading-snug">
                <span className="font-semibold">{item.text}</span>{" "}
                <span className="text-stone-600">
                  {item.prior ? `${item.prior} → ` : ""}
                  <span className="font-semibold text-stone-800">{item.current}</span>
                </span>
                <div className="text-sm text-stone-600 mt-0.5">{item.why}</div>
                <div className="text-[11px] text-stone-400 mt-0.5 font-mono">{item.source}</div>
              </div>
            </div>
          ))
        )}

        {card.interactionCheck && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3.5 py-2.5 text-sm">
            <span className="font-bold">Interaction check:</span> {card.interactionCheck}
          </div>
        )}

        {card.overflowNote && <div className="text-xs text-stone-500">{card.overflowNote}</div>}

        <div className="text-sm text-stone-600 border-t border-stone-100 pt-3">
          <span className="font-semibold">Pending:</span> {card.pending.length > 0 ? card.pending.join(", ") : "none"}
        </div>
      </div>
    </div>
  );
}
