# 3-Minute Judge Walkthrough

> Before demoing: both servers running, browser at `localhost:5173`. To reset to a clean v1.0 state between run-throughs: `curl -X POST localhost:8787/api/reset` then reload the page.

## Beat 1 — The problem (15s)

"Before an ED doc walks into a room, the answer to 'what do I need to know?' is scattered across hundreds of FHIR resources and — worse — inside faxed PDFs nobody reads. We built a pre-visit agent on top of the same Epic API surface Abridge already uses."

## Beat 2 — Run the agent on Walter Reyes (60s)

1. Click **Run Pre-Visit Agent** on Walter Reyes (68M, chest pain).
2. Narrate the **Live Agent Activity** panel: *five sub-agents in parallel, each hitting real Epic API names — Patient.Read, Observation.Search (Labs), Binary.Read — you can watch resource counts and latency live.*
3. When the card lands, point at the top item: **"Sildenafil taken ~11h prior to arrival (per EMS) — nitrates contraindicated."**
   - *"That fact exists nowhere in structured data. Our Document Intelligence agent read the EMS run-sheet PDF. That's an error-prevention catch: NTG after sildenafil drops pressure catastrophically."*
4. Second beat: chronic LBBB → "apply Sgarbossa," and the faxed cardiology consult showing the stress workup was never completed.

## Beat 3 — Teach the agent (45s)

1. Hover **Meds That Matter Now** → **Teach the agent** → type a preference (e.g. "always show last anticoagulant dose timing").
2. Show the header: version bumps **v1.0 → v1.1**, badge on the sliders icon.
3. Open the **eye icon**: *"full transparency — this is the base specialty prompt."* Open the **sliders icon**: *"and these are the physician's own edits layered on top."*
4. Open the **version dropdown**: *"docs keep different versions per population — here's a Geriatric-focused variant. This is how one scaffold scales across specialties and physicians."*

## Beat 4 — The Delta Card (45s)

1. Click **Simulate: 45 min later — first results arrive**. *"The doc is now 6 patients deep. New results just landed."*
2. Click **Run Delta Agent**.
3. Read the card: **ACT: hs-Troponin 8 → 62.** ECG final read with Sgarbossa status. And *"a stress-echo fax arrived 3 minutes ago — the agent read it already: equivocal ischemia, never followed up."*
4. Point at the **interaction check** (apixaban vs cath) and the **Pending** line: *"max three items, interruption-budgeted — silence is a valid answer; the spec forbids padding."*

## Beat 5 — Close (15s)

"Base specialty prompts + physician teaching + versioning = an agent that gets personally better every shift, on the API surface Abridge already ships. Two more patients in the schedule show the same pipeline catching an ESBL organism empiric ceftriaxone would miss, and a Crohn's patient whose appendix — per an outside op-note PDF — isn't there."

## Backup

- If live runs feel risky: `npm run card:walter` output is deterministic-ish and can be shown in terminal.
- Margaret Okafor: ESBL + mechanical valve + SJS allergy story. Jasmine Cole: no-appendix + masked inflammation + hCG-gating story.
- Runs take ~60–90s; fill the time narrating the activity panel (that IS the demo).
