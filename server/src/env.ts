import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load the repo root's .env (holds ANTHROPIC_API_KEY), then any server-local overrides
dotenv.config({ path: path.resolve(here, "../../.env") });
dotenv.config({ path: path.resolve(here, "../.env") });

export const MODEL = process.env.PREVISIT_MODEL ?? "claude-sonnet-5";
/** "cached" = replay recorded runs fast (demo default); "live" = always call the API. */
export const RUN_MODE = (process.env.PREVISIT_MODE ?? "cached") as "cached" | "live";
export const REPLAY_PREVISIT_MS = Number(process.env.PREVISIT_REPLAY_MS ?? 11000);
export const REPLAY_DELTA_MS = Number(process.env.PREVISIT_REPLAY_DELTA_MS ?? 5500);
export const SUBAGENT_EFFORT = process.env.PREVISIT_SUBAGENT_EFFORT ?? "low";
export const SYNTHESIS_EFFORT = process.env.PREVISIT_SYNTHESIS_EFFORT ?? "medium";
export const PORT = Number(process.env.PORT ?? 8787);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("WARNING: ANTHROPIC_API_KEY not found in environment");
}
