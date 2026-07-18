import { useState } from "react";
import type { CardSection, RoomEntryCard } from "../types";
import { GraduationCap, SeverityIcon } from "./icons";

const SECTION_ORDER = ["approach", "meds", "micro_imaging", "ecg_delta", "risk_flags"];
const SECTION_TITLES: Record<string, string> = {
  approach: "Things That Change My Approach",
  meds: "Meds That Matter Now",
  micro_imaging: "Micro & Imaging That Change Empirics",
  ecg_delta: "ECG Delta",
  risk_flags: "One-Liner Risk Flags",
};

function SkeletonSection({ title }: { title: string }) {
  return (
    <div className="mb-8">
      <div className="text-[11px] font-bold tracking-[0.14em] text-stone-400 uppercase mb-3">{title}</div>
      <div className="space-y-2.5">
        <div className="skeleton h-4 w-[92%]" />
        <div className="skeleton h-4 w-[70%]" />
      </div>
    </div>
  );
}

function TeachButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-full px-3 py-1 hover:bg-indigo-soft hover:text-indigo-brand-dark hover:border-indigo-brand/30 bg-white"
    >
      <GraduationCap /> Teach the agent
    </button>
  );
}

function TeachPopover({
  sectionTitle,
  onSubmit,
  onClose,
}: {
  sectionTitle: string;
  onSubmit: (instruction: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="absolute right-0 top-8 z-20 w-96 bg-white rounded-xl border border-stone-200 shadow-xl p-4">
      <div className="text-sm font-bold mb-1">Teach the agent</div>
      <div className="text-xs text-stone-500 mb-3">
        How should <span className="font-semibold">“{sectionTitle}”</span> work for you in future runs? Your feedback becomes part of this
        agent's next version.
      </div>
      {saved ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm">
          Saved. Your next <span className="font-semibold">Regenerate</span> will use this preference.
        </div>
      ) : (
        <>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Show the last 5–10 sets of vitals, not just the most recent"'
            className="w-full h-24 text-sm border border-stone-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-brand/40 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onClose} className="text-sm text-stone-500 px-3 py-1.5 rounded-full hover:bg-stone-100">
              Cancel
            </button>
            <button
              disabled={!text.trim() || saving}
              onClick={async () => {
                setSaving(true);
                await onSubmit(text.trim());
                setSaving(false);
                setSaved(true);
                setTimeout(onClose, 1600);
              }}
              className="text-sm font-semibold bg-indigo-brand hover:bg-indigo-brand-dark disabled:opacity-50 text-white px-4 py-1.5 rounded-full"
            >
              {saving ? "Saving…" : "Save preference"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({
  section,
  onTeach,
}: {
  section: CardSection;
  onTeach: (sectionId: string, instruction: string) => Promise<void>;
}) {
  const [teaching, setTeaching] = useState(false);
  return (
    <div className="mb-8 group relative">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold tracking-[0.14em] text-stone-400 uppercase">{section.title}</div>
        <div className="relative">
          <TeachButton onClick={() => setTeaching(true)} />
          {teaching && (
            <TeachPopover
              sectionTitle={section.title}
              onClose={() => setTeaching(false)}
              onSubmit={(instruction) => onTeach(section.id, instruction)}
            />
          )}
        </div>
      </div>
      <div className="space-y-2.5">
        {section.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <SeverityIcon severity={item.severity} />
            <div className="text-[15px] leading-snug">
              <span>{item.text}</span>
              {item.sources.filter((s) => s.ref !== "n/a").length > 0 && (
                <span
                  className="ml-2 inline-flex items-center text-[11px] font-medium text-stone-500 bg-stone-100 rounded-full px-2 py-0.5 align-middle cursor-default"
                  title={item.sources.map((s) => s.label).join("\n")}
                >
                  {item.sources.filter((s) => s.ref !== "n/a").length} source
                  {item.sources.filter((s) => s.ref !== "n/a").length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        ))}
        {section.items.length === 0 && <div className="text-sm text-stone-400 italic">Nothing qualifying</div>}
      </div>
    </div>
  );
}

export function CardView({
  card,
  loading,
  patientHeader,
  onTeach,
}: {
  card: RoomEntryCard | null;
  loading: boolean;
  patientHeader: { name: string; age: number; sex: string; mrn: string };
  onTeach: (sectionId: string, instruction: string) => Promise<void>;
}) {
  const sections: CardSection[] =
    card?.sections?.slice().sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id)) ?? [];

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(28,25,23,0.06),0_8px_24px_-12px_rgba(28,25,23,0.12)] overflow-hidden">
      <div className="px-8 pt-7 pb-5 border-b border-stone-100">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">{patientHeader.name}</h2>
          <div className="text-stone-500 text-sm">
            {patientHeader.age}
            {patientHeader.sex} · MRN {patientHeader.mrn}
          </div>
        </div>
        <div className="mt-4">
          {card ? (
            <div className="bg-indigo-soft/60 text-indigo-950 rounded-lg px-4 py-2.5 text-[15px] font-semibold">{card.oneLiner}</div>
          ) : (
            <div className="skeleton h-10 w-full rounded-lg" />
          )}
        </div>
      </div>

      <div className="px-8 py-6">
        {card
          ? sections.map((s) => <Section key={s.id} section={s} onTeach={onTeach} />)
          : SECTION_ORDER.map((id) => <SkeletonSection key={id} title={SECTION_TITLES[id]} />)}
        {!card && !loading && (
          <div className="text-sm text-stone-400 italic">Run the pre-visit agent to generate this card.</div>
        )}
      </div>

      <div className="px-8 py-4 bg-stone-50 border-t border-stone-100 text-xs text-stone-400">
        AI-generated pre-visit draft for clinical decision support. Verify all facts in the chart before acting — this summary does not
        replace chart review.
      </div>
    </div>
  );
}
