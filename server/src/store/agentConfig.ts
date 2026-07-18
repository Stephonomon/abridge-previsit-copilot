import fs from "fs";
import path from "path";
import { DATA_DIR } from "../data/store.js";
import type { AgentConfig, AgentVersion, Customization } from "../types.js";

const CONFIG_PATH = path.join(DATA_DIR, "agent-config.json");

const DEFAULT_CONFIG: Record<string, AgentConfig> = {
  "emergency-medicine": {
    specialty: "emergency-medicine",
    agentName: "EM Chart-Review Copilot",
    basePromptFile: "prompts/room_entry_card.md",
    deltaPromptFile: "prompts/delta_card.md",
    versions: [
      { id: "v1.0", label: "Base scaffold", customizations: [], createdAt: "2026-07-18T08:00:00-04:00" },
      {
        id: "v1.0-geriatric",
        label: "Geriatric-focused",
        customizations: [
          {
            id: "c-geri-1",
            section: "global",
            instruction:
              "This physician sees a predominantly geriatric panel. Always surface fall risk, polypharmacy (>8 active meds), baseline cognitive status if documented, and code status even when not directly related to the chief complaint.",
            createdAt: "2026-07-18T08:00:00-04:00",
          },
          {
            id: "c-geri-2",
            section: "meds",
            instruction: "Flag any Beers-list medication relevant to the presentation.",
            createdAt: "2026-07-18T08:00:00-04:00",
          },
        ],
        createdAt: "2026-07-18T08:00:00-04:00",
      },
    ],
    activeVersionId: "v1.0",
  },
};

let cache: Record<string, AgentConfig> | null = null;

export function __resetCache(): void {
  cache = null;
}

export function loadConfigs(): Record<string, AgentConfig> {
  if (cache) return cache;
  if (fs.existsSync(CONFIG_PATH)) {
    cache = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } else {
    cache = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    save();
  }
  return cache!;
}

function save(): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cache, null, 2));
  } catch {
    // read-only filesystem (serverless) — config lives in memory for this instance
  }
}

export function getConfig(specialty: string): AgentConfig {
  const cfg = loadConfigs()[specialty];
  if (!cfg) throw new Error(`Unknown specialty: ${specialty}`);
  return cfg;
}

export function activeVersion(cfg: AgentConfig): AgentVersion {
  return cfg.versions.find((v) => v.id === cfg.activeVersionId) ?? cfg.versions[0];
}

export function setActiveVersion(specialty: string, versionId: string): AgentConfig {
  const cfg = getConfig(specialty);
  if (!cfg.versions.some((v) => v.id === versionId)) throw new Error(`Unknown version: ${versionId}`);
  cfg.activeVersionId = versionId;
  save();
  return cfg;
}

/**
 * Add feedback ("teach the agent"). If the active version is a pristine base
 * version (no customizations), a new draft version is created (v1.0 -> v1.1);
 * otherwise the instruction is appended to the active version.
 */
export function addFeedback(specialty: string, section: string, instruction: string): AgentConfig {
  const cfg = getConfig(specialty);
  let version = activeVersion(cfg);
  const isBase = version.customizations.length === 0 && /^v\d+\.\d+$/.test(version.id);
  if (isBase) {
    const [maj, min] = version.id.slice(1).split(".").map(Number);
    const newId = `v${maj}.${min + 1}`;
    const draft: AgentVersion = {
      id: newId,
      label: "Customized",
      customizations: [],
      createdAt: new Date().toISOString(),
    };
    cfg.versions.push(draft);
    cfg.activeVersionId = newId;
    version = draft;
  }
  const c: Customization = {
    id: `c_${Date.now()}`,
    section,
    instruction,
    createdAt: new Date().toISOString(),
  };
  version.customizations.push(c);
  save();
  return cfg;
}

export function removeCustomization(specialty: string, customizationId: string): AgentConfig {
  const cfg = getConfig(specialty);
  for (const v of cfg.versions) {
    v.customizations = v.customizations.filter((c) => c.id !== customizationId);
  }
  save();
  return cfg;
}

export function renameVersion(specialty: string, versionId: string, label: string): AgentConfig {
  const cfg = getConfig(specialty);
  const v = cfg.versions.find((x) => x.id === versionId);
  if (v) v.label = label;
  save();
  return cfg;
}
