import "../env.js";
import { getPatient } from "../data/store.js";
import { createRun } from "../events/bus.js";
import { runPrevisit } from "../agents/orchestrator.js";
import { runDelta } from "../agents/delta.js";

/**
 * MVP gate: run the full pre-visit pipeline headless and print the card.
 * Usage: tsx src/cli/runCard.ts <patient-id> [--delta]
 */
async function main() {
  const patientId = process.argv[2] ?? "walter-reyes";
  const doDelta = process.argv.includes("--delta");
  const rec = getPatient(patientId);

  console.log(`\n=== Pre-visit run: ${rec.meta.name} (${rec.meta.chiefComplaint}) ===\n`);
  const run = createRun(patientId, "previsit");
  run.emitter.on("event", (e: any) => {
    if (e.type === "fhir_call") console.log(`  [${e.agent}] ${e.api}  ${e.resourceCount} res · ${e.ms}ms`);
    if (e.type === "agent_started") console.log(`▶ ${e.label}`);
    if (e.type === "agent_done") console.log(`✓ ${e.label} — ${e.findingsCount} findings in ${(e.ms / 1000).toFixed(1)}s`);
    if (e.type === "synthesis_started") console.log(`▶ Synthesis`);
    if (e.type === "run_complete")
      console.log(`\n★ ${e.agentCount} agents read ${e.totalResources} FHIR resources across ${e.totalApiCalls} Epic API calls in ${(e.totalMs / 1000).toFixed(1)}s`);
  });

  const card = await runPrevisit(run, rec);
  console.log("\n----- ROOM-ENTRY CARD -----\n");
  console.log(JSON.stringify(card, null, 2));

  if (doDelta) {
    rec.releasedStages = Math.min(rec.releasedStages + 1, rec.events.stages.length);
    console.log(`\n=== Delta run (stage ${rec.releasedStages}: ${rec.events.stages[rec.releasedStages - 1].label}) ===\n`);
    const drun = createRun(patientId, "delta");
    drun.emitter.on("event", (e: any) => {
      if (e.type === "fhir_call") console.log(`  [delta] ${e.api}  ${e.resourceCount} res · ${e.ms}ms`);
    });
    const delta = await runDelta(drun, rec);
    console.log("\n----- DELTA CARD -----\n");
    console.log(JSON.stringify(delta, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
