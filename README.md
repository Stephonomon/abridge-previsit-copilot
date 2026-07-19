# Physician Co-pilot

*An agentic clinical decision-support demo for the Emergency Department, built at the [Abridge x Anthropic "Future of Agentic AI in Healthcare" hackathon](https://cerebralvalley.ai/e/abridge-hackathon), San Francisco.*

**🎬 Watch the demo:** [youtu.be/TSwHBSF12vo](https://youtu.be/TSwHBSF12vo)

---

## Why we built this

Abridge's CEO, Shiv Rao, opened the hackathon by naming the problem every clinician already knows in their bones: **critical patient information is fragmented across the chart, hard to find under time pressure, and easy to miss** — a stray line in a faxed outside note, a med buried three tabs deep, a trend that only means something once you connect two results that landed an hour apart. The challenge to 150 hackathon participants: build something with real-world impact a healthcare team could actually use on Monday morning.

[Stephon Proctor](https://github.com/Stephonomon) and John Lee, MD (Emergency Medicine) spent the day building an answer to that problem for the ED, in 12 hours: a copilot that lives inside the chart, reads everything the physician doesn't have time to, and surfaces what actually matters — the moment it matters — with the reasoning shown and the next action one click away.

## What it does

Physician Co-pilot pairs two complementary AI systems inside a mock Epic-style EHR:

- **Abridge AI — instant clinical decision support.** A deterministic rules engine that matches live chart findings against an authored knowledge base and fires prioritized recommendations the instant new results land — no LLM call, no wait. Every recommendation is **grounded twice**: once in the specific chart fact that triggered it, once in the clinical guideline that makes it standard of care. Each comes with one-click, pre-filled actions (secure messages, orders) that a physician can send in seconds instead of typing from scratch.
- **A multi-agent LLM pipeline — the narrative pull.** Five Claude tool-use sub-agents fan out across a simulated Epic EHR (mirroring Abridge's real incoming Epic API surface), read structured FHIR data **and** the PDFs buried in the chart (faxes, EMS run sheets, outside reports), and synthesize a dense, scannable **pre-visit brief** — plus a **Delta Card** when new results come in mid-encounter. Physicians can "teach the agent" a preference right on a card section, which versions the prompt (v1.0 → v1.1) and shapes every future run.

Both surface in a single floating, always-accessible copilot window — draggable, collapsible, never more than a click away — inside a mock ED trackboard-and-chart EHR shell.

**The story we demo end-to-end:** Walter Reyes, a 68-year-old with chest pain, arrives ESI 2. Abridge AI catches a sildenafil-and-planned-nitrates contraindication from the EMS run sheet before triage is even done. As the case evolves — a widened mediastinum on CXR, then a confirming CT — the same rules engine escalates the ribbon to a pulsing **SURGICAL EMERGENCY** badge and hands the physician five pre-filled, one-click actions (CV surgery consult, hold anticoagulation, type & cross, OR booking) the instant the diagnosis confirms.

Built for Emergency Medicine in a single day, the architecture is intentionally specialty-scoped — the same pattern (mock FHIR layer + sub-agents + authored KB) is designed to generalize across the ~50 specialties Abridge already supports in production.

## Architecture

```
web/  (Vite + React + Tailwind)          server/  (Express + Anthropic SDK)
┌────────────────────────────┐           ┌──────────────────────────────────────┐
│ Trackboard → Patient chart │  SSE      │ Orchestrator                         │
│ Abridge AI CDS panel       │◀──────────│  ├─ Chart Overview Agent    ┐        │
│ Live Agent Activity panel  │           │  ├─ Meds & Problems Agent   │ tool-  │
│ Teach-the-agent popovers   │  REST     │  ├─ Results Agent           │ use    │
│ Prompt/customizations      │──────────▶│  ├─ Notes & Context Agent   │ loops  │
│ drawers · Delta Card       │           │  └─ Document Intel Agent (PDFs) ┘    │
└────────────────────────────┘           │        ↓ findings                    │
                                         │  Synthesis (room_entry_card.md       │
                                         │   + physician customizations)        │
                                         │  Delta Agent (delta_card.md)         │
                                         │        ↑                             │
                                         │  Mock Epic FHIR layer (real Epic     │
                                         │  API names) over patient fixtures    │
                                         └──────────────────────────────────────┘
```

- **Mock Epic FHIR layer** — `server/src/fhir/operations.ts` exposes operations named verbatim after Abridge's Epic incoming APIs (`Observation.Search (Labs) (R4)`, `Binary.Read (External CCDA) (R4)`, …) over three deeply-authored fictional ED patients. Every call emits telemetry to the Live Agent Activity panel.
- **Sub-agents** — real Claude tool-use loops (model: `claude-sonnet-5`), each scoped to its own API subset. The Document Intelligence agent receives faxed PDFs as native document blocks and extracts facts structured data misses (e.g. sildenafil use documented only in the EMS run sheet).
- **Feedback → versions** — "Teach the agent" feedback on any card section becomes a physician customization layered on the base specialty prompt; the first piece of feedback drafts a new version (v1.0 → v1.1) automatically. Eye icon = base prompt (read-only); sliders icon = your customizations.
- **Delta agent** — staged results (`events.json` per patient) release via "Simulate"; the delta agent compares against the prior card and interrupts with a max-3-item ACT/NOTE card plus a Pending line.
- **Abridge AI CDS** — `server/src/cds/engine.ts` matches per-patient authored findings (`server/data/patients/<id>/cds.json`) against a topic knowledge base (`server/data/kb/*.json`: rules, why-it-matters, recommendations, evidence lines, one-click actions) filtered to the current chart stage. Pure data matching, zero LLM calls, so it's instant and reacts the moment you click **Simulate** — independent of whether the narrative agent has run. On Walter Reyes, the chest-pain topic fires immediately at triage; staging in the widened-mediastinum CXR and then the CT confirms a Stanford Type A dissection, flipping the ribbon to a pulsing **SURGICAL EMERGENCY** badge with pre-filled actions.

## Run it locally

Requires Node 18+.

```bash
git clone https://github.com/Stephonomon/abridge-previsit-copilot.git
cd abridge-previsit-copilot
npm install
```

The repo ships with a pre-recorded replay cache, so **it runs fully offline out of the box — no API key required.**

```bash
npm run dev:server   # terminal 1 — :8787
npm run dev:web      # terminal 2 — :5173
```

Then open **http://localhost:5173**.

Only needed if you want to run agents live or re-record the cache:

```bash
cp .env.example .env        # add your ANTHROPIC_API_KEY
npm run gen:pdfs --workspace server   # one-time: render the faxed-PDF fixtures
npm run warm --workspace server       # re-record the replay cache with fresh live runs
```

**Demo speed:** by default (`PREVISIT_MODE=cached`) runs replay recorded live runs with compressed pacing — ~10s pre-visit, ~5s delta. Set `PREVISIT_MODE=live` in `.env` to always call the API instead (~60–90s per run). Headless smoke test: `npm run card:walter` (add `--delta`).

If you edit the CDS knowledge base (`server/data/kb/*.json`), restart the dev server — those files are cached in-memory via `fs.readFileSync` and aren't picked up by hot reload.

A workspace reset (state jumps back to arrival, clears all sent actions) is one click away: the circular-arrow icon in the top bar, or `POST /api/reset`.

## Patients

| Patient | Presentation | Buried treasure |
|---|---|---|
| Walter Reyes, 68M | Chest pain, ESI 2 | Sildenafil last night (EMS PDF only); chronic LBBB → Sgarbossa; incomplete stress workup in faxed consult; delta: troponin 8→62 + newly faxed equivocal stress echo; also the only patient wired into the Abridge AI CDS layer (chest-pain contraindication → widened mediastinum → confirmed aortic dissection) |
| Margaret Okafor, 74F | Fever + dysuria, ESI 2 | Prior ESBL E. coli (ceftriaxone would miss); mechanical mitral valve on warfarin; SJS to TMP-SMX; delta: lactate 3.4 → cleared after fluids |
| Jasmine Cole, 29F | Abdominal pain, ESI 3 | Crohn's on biologic + steroid (masked inflammation); **no appendix** (outside op-note PDF); uncertain LMP; delta: hCG neg → CT shows anastomotic abscess |

All data is fully synthetic. This is a hackathon demo, not a medical device; every card carries a verify-in-chart disclaimer.

## Further reading

- [`DEMO.md`](DEMO.md) — the 3-minute judge walkthrough script we presented from.

## Credits

Built in one day by **Stephon Proctor** and **John Lee, MD** (Emergency Medicine) at the Abridge x Anthropic hackathon, hosted with Lightspeed and Cerebral Valley — July 18, 2026, San Francisco.
