# Pre-Visit Copilot

**Live demo:** https://abridge-previsit-copilot.vercel.app (cached-replay mode — no API key required)

An agentic ED pre-visit intelligence demo built for the Abridge **Future of Agentic AI in Healthcare** hackathon by Stephon Proctor + John Lee, MD.

Five Claude sub-agents fan out across a simulated Epic EHR (mirroring Abridge's real incoming Epic API surface), mine structured FHIR R4 data **and** the PDFs buried in the chart (faxes, EMS run sheets, outside reports), and synthesize a physician-taught, versioned **Room-Entry Card** — plus a mid-encounter **Delta Card** when new results land. Sitting above that narrative pull is **Abridge AI**, an instant, non-LLM clinical decision support layer: a rules engine that matches chart findings against an authored knowledge base and fires prioritized recommendations with one-click actions (secure messages, orders) — no wait, live from the moment the chart opens.

## Architecture

```
web/  (Vite + React + Tailwind)          server/  (Express + Anthropic SDK)
┌────────────────────────────┐           ┌──────────────────────────────────────┐
│ Schedule → Card view       │  SSE      │ Orchestrator                         │
│ Live Agent Activity panel  │◀──────────│  ├─ Chart Overview Agent    ┐        │
│ Teach-the-agent popovers   │           │  ├─ Meds & Problems Agent   │ tool-  │
│ Prompt/version drawers     │  REST     │  ├─ Results Agent           │ use    │
│ Delta Card                 │──────────▶│  ├─ Notes & Context Agent   │ loops  │
└────────────────────────────┘           │  └─ Document Intel Agent (PDFs) ┘    │
                                         │        ↓ findings                    │
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
- **Feedback → versions** — "Teach the agent" feedback becomes section-scoped customizations layered on the base specialty prompt; versions (v1.0 → v1.1, "Geriatric-focused", …) are switchable per patient population. Eye icon = base prompt; sliders icon = your edits.
- **Delta agent** — staged results (`events.json` per patient) release via "Simulate: 45 min later"; the delta agent compares against the prior card and interrupts with a max-3-item ACT/NOTE card plus a Pending line.
- **Abridge AI CDS** — `server/src/cds/engine.ts` matches per-patient authored findings (`server/data/patients/<id>/cds.json`) against a topic knowledge base (`server/data/kb/*.json`: rules, why-it-matters, recommendations, evidence lines, one-click actions) filtered to the current chart stage. Pure data matching, zero LLM calls, so it's instant and reacts the moment you click `Simulate` — independent of whether the narrative agent has run. On Walter Reyes, the chest-pain topic fires immediately at triage (sildenafil/nitrate contraindication with a one-click pharmacy alert); staging in the widened-mediastinum CXR and then the CT confirms a Stanford Type A dissection, flipping the ribbon to a pulsing **SURGICAL EMERGENCY** badge with five pre-filled actions (CV surgery consult, hold anticoagulation, type & cross, OR booking).

## Run

```bash
npm install
npm run gen:pdfs --workspace server   # one-time: render the faxed-PDF fixtures
npm run dev:server                    # :8787  (needs ANTHROPIC_API_KEY in ../.env)
npm run dev:web                       # :5173
```

**Demo speed:** by default (`PREVISIT_MODE=cached`) runs replay recorded live runs with compressed pacing — ~10s pre-visit, ~5s delta. `npm run warm --workspace server` re-records the cache with fresh live runs; `PREVISIT_MODE=live` always calls the API (~60–90s per run). Headless check: `npm run card:walter` (add `--delta`).

## Patients

| Patient | Presentation | Buried treasure |
|---|---|---|
| Walter Reyes, 68M | Chest pain, ESI 2 | Sildenafil last night (EMS PDF only); chronic LBBB → Sgarbossa; incomplete stress workup in faxed consult; delta: troponin 8→62 + newly faxed equivocal stress echo |
| Margaret Okafor, 74F | Fever + dysuria, ESI 2 | Prior ESBL E. coli (ceftriaxone would miss); mechanical mitral valve on warfarin; SJS to TMP-SMX; delta: lactate 3.4 → cleared after fluids |
| Jasmine Cole, 29F | Abdominal pain, ESI 3 | Crohn's on biologic + steroid (masked inflammation); **no appendix** (outside op-note PDF); uncertain LMP; delta: hCG neg → CT shows anastomotic abscess |

All data is fully synthetic. This is a demo, not a medical device; every card carries a verify-in-chart disclaimer.
