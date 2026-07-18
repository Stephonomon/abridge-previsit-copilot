import fs from "fs";
import path from "path";
import { DATA_DIR } from "../data/store.js";
import { activeVersion, getConfig } from "../store/agentConfig.js";
import type { AgentVersion } from "../types.js";

export function basePrompt(specialty: string, kind: "previsit" | "delta"): string {
  const cfg = getConfig(specialty);
  const file = kind === "previsit" ? cfg.basePromptFile : cfg.deltaPromptFile;
  return fs.readFileSync(path.join(DATA_DIR, file), "utf8");
}

const SECTION_NAMES: Record<string, string> = {
  global: "All sections",
  one_liner: "One-Line Frame",
  approach: "Things That Change My Approach",
  meds: "Meds That Matter Now",
  micro_imaging: "Micro & Imaging That Change Empirics",
  ecg_delta: "ECG Delta",
  risk_flags: "One-Liner Risk Flags",
};

export function customizationBlock(version: AgentVersion): string {
  if (version.customizations.length === 0) return "";
  const lines = version.customizations.map(
    (c) => `- [${SECTION_NAMES[c.section] ?? c.section}] ${c.instruction}`
  );
  return `\n\n---\n\n## Physician Customizations (version ${version.id} — "${version.label}")\n\nThe physician using this agent has taught it the following preferences. Apply them on top of the base instructions above. Where they conflict with the base instructions, the physician's preferences win.\n\n${lines.join("\n")}\n`;
}

/** Full system prompt = base prompt + active version's customizations. */
export function composedPrompt(specialty: string, kind: "previsit" | "delta"): { prompt: string; versionId: string } {
  const cfg = getConfig(specialty);
  const version = activeVersion(cfg);
  return { prompt: basePrompt(specialty, kind) + customizationBlock(version), versionId: version.id };
}
