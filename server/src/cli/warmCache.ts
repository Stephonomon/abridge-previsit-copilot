import "../env.js";
import { getPatient, loadAllPatients } from "../data/store.js";
import { createRun } from "../events/bus.js";
import { runPrevisit } from "../agents/orchestrator.js";
import { runDelta } from "../agents/delta.js";

/**
 * Warm the demo replay cache: for each patient, run the live pipeline once
 * (pre-visit, then each staged delta) and record the event streams. After this,
 * PREVISIT_MODE=cached (the default) replays these runs in seconds.
 *
 * Usage: npm run warm --workspace server   (needs ANTHROPIC_API_KEY)
 */
async function main() {
  const only = process.argv[2]; // optional patient id
  for (const rec of loadAllPatients()) {
    if (only && rec.meta.id !== only) continue;
    // fresh state
    rec.releasedStages = 0;
    rec.lastDeltaCheckedStage = 0;
    rec.lastCard = null;

    console.log(`\n=== Warming ${rec.meta.name} — pre-visit ===`);
    const run = createRun(rec.meta.id, "previsit");
    run.emitter.on("event", (e: any) => {
      if (e.type === "agent_done") console.log(`  ✓ ${e.label} (${e.findingsCount} findings)`);
      if (e.type === "run_complete") console.log(`  ★ ${(e.totalMs / 1000).toFixed(1)}s, ${e.totalApiCalls} calls`);
    });
    await runPrevisit(run, rec);

    for (let stage = 1; stage <= rec.events.stages.length; stage++) {
      rec.releasedStages = stage;
      console.log(`=== Warming ${rec.meta.name} — delta stage ${stage} (${rec.events.stages[stage - 1].label}) ===`);
      const drun = createRun(rec.meta.id, "delta");
      const card = await runDelta(drun, rec);
      console.log(`  ✓ delta: ${card.noDelta ? "no-delta state" : `${card.items.length} items`}`);
    }
  }
  console.log("\nCache warmed. Set PREVISIT_MODE=cached (default) for fast replays.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
