import { useState } from "react";
import type { CdsAction, Patient } from "../types";

export function confirmationFor(action: CdsAction): string {
  return action.type === "secure_message"
    ? `Sent to ${action.recipient?.name} via ${action.recipient?.channel}`
    : `${action.orderDetails?.orderType ?? "Order"} placed — ${action.label}`;
}

function fillTemplate(template: string, patient: Patient): string {
  const vitals = patient.triageVitals ?? {};
  const vals: Record<string, string> = {
    name: patient.name,
    age: String(patient.age),
    sex: patient.sex,
    mrn: patient.mrn,
    bed: patient.room,
    chief_complaint: patient.chiefComplaint,
    hr: String(vitals.hr ?? "—"),
    bp: String(vitals.bp ?? "—"),
  };
  return template.replace(/\{(\w+)\}/g, (m, key) => vals[key] ?? m);
}

export function ActionModal({
  action,
  patient,
  onClose,
  onSend,
}: {
  action: CdsAction;
  patient: Patient;
  onClose: () => void;
  onSend: (confirmation: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const isMessage = action.type === "secure_message";
  const body = isMessage && action.template ? fillTemplate(action.template, patient) : null;

  const send = () => {
    setSending(true);
    setTimeout(() => {
      onSend(confirmationFor(action));
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-w-[92vw] max-h-[85vh] flex flex-col border border-stone-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-indigo-brand text-white flex items-center gap-2">
          <span className="text-lg leading-none">{isMessage ? "💬" : "📋"}</span>
          <div className="font-bold text-sm flex-1">{action.label}</div>
          <button onClick={onClose} className="hover:opacity-70 text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto text-sm">
          {isMessage ? (
            <>
              <div className="flex items-center gap-2 mb-3 text-xs text-stone-500">
                <span className="font-semibold text-stone-700">To:</span> {action.recipient?.name}
                <span className="text-stone-300">·</span>
                {action.recipient?.channel}
              </div>
              <textarea
                readOnly
                value={body ?? ""}
                className="w-full h-72 text-[13px] font-mono leading-relaxed border border-stone-200 rounded-lg p-3 bg-stone-50 resize-none"
              />
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wide text-stone-400">{action.orderDetails?.orderType}</div>
              <div className="border border-stone-200 rounded-lg divide-y divide-stone-100">
                {action.orderDetails?.items.map((item, i) => (
                  <div key={i} className="px-3 py-2 text-[13px] font-medium">
                    {item}
                  </div>
                ))}
              </div>
              <div className="text-[13px]">
                <span className="font-semibold text-stone-600">Indication: </span>
                {action.orderDetails?.indication}
              </div>
              <div className="inline-block text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                {action.orderDetails?.priority}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-stone-200 flex justify-end gap-2 bg-stone-50">
          <button onClick={onClose} className="text-sm text-stone-500 px-4 py-2 rounded-full hover:bg-stone-100">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="text-sm font-semibold bg-indigo-brand hover:bg-indigo-brand-dark disabled:opacity-60 text-white px-5 py-2 rounded-full"
          >
            {sending ? "Sending…" : isMessage ? "Send message" : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
