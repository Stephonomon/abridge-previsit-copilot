import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load the hackathon folder's .env (holds ANTHROPIC_API_KEY), then any local overrides
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config({ path: path.resolve(here, "../.env") });

export const MODEL = process.env.PREVISIT_MODEL ?? "claude-sonnet-5";
export const SUBAGENT_EFFORT = process.env.PREVISIT_SUBAGENT_EFFORT ?? "low";
export const SYNTHESIS_EFFORT = process.env.PREVISIT_SYNTHESIS_EFFORT ?? "medium";
export const PORT = Number(process.env.PORT ?? 8787);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("WARNING: ANTHROPIC_API_KEY not found in environment");
}
