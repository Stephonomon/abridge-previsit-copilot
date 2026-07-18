// Shared helpers for the mock EHR shell ("Meridian Health — ED")

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${fmtDate(iso)} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export const BED_COLORS: Record<string, string> = {
  "ED 14": "bg-fuchsia-500",
  "ED 9": "bg-rose-500",
  "ED 22": "bg-sky-500",
};

export function acuityBadge(esi: number): { label: string; cls: string } {
  if (esi <= 2) return { label: String(esi), cls: "bg-red-500 text-white" };
  if (esi === 3) return { label: "3", cls: "bg-amber-400 text-amber-950" };
  return { label: String(esi), cls: "bg-emerald-500 text-white" };
}

/** Storyboard alert derived from active meds/problems (mimics Epic's banner). */
export function storyboardAlert(chart: any): string | null {
  const meds = JSON.stringify(chart?.medicationRequests ?? "").toLowerCase();
  if (meds.includes("apixaban") || meds.includes("warfarin")) return "On blood thinners";
  if (meds.includes("adalimumab") || meds.includes("azathioprine")) return "Immunocompromised";
  return null;
}

export function labValue(o: any): string {
  if (o.valueQuantity) return `${o.valueQuantity.value} ${o.valueQuantity.unit ?? ""}`.trim();
  if (o.valueString) return o.valueString;
  return "—";
}

export function labFlag(o: any): "H" | "L" | "" {
  const v = o.valueQuantity?.value;
  const rr = o.referenceRange?.[0];
  if (typeof v !== "number" || !rr) return "";
  if (rr.high?.value !== undefined && v > rr.high.value) return "H";
  if (rr.low?.value !== undefined && v < rr.low.value) return "L";
  return "";
}

export function refRange(o: any): string {
  const rr = o.referenceRange?.[0];
  if (!rr) return "—";
  const lo = rr.low?.value;
  const hi = rr.high?.value;
  if (lo !== undefined && hi !== undefined) return `${lo}–${hi}`;
  if (hi !== undefined) return `< ${hi}`;
  if (lo !== undefined) return `> ${lo}`;
  return "—";
}
