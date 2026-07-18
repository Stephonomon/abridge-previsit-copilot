# Presentation Script — Pre-Visit Copilot

Two separate scripts: a **60-second recorded demo** (voiceover over screen capture, no live audience interaction) and a **3-minute live demo** (in front of an audience — Abridge employees, software engineers, other tech companies). Every click below maps to real, working functionality in the app as of this build — nothing is aspirational or faked for the video.

**Presenters:** John (ED physician, informaticist, Epic-certified builder) and Stephon (psychologist, informaticist, Epic-certified builder). Both can speak to the build/architecture side — lean on John for clinical framing, Stephon for the "why we built it this way" framing, but swap freely.

**Audience assumption:** mixed clinical fluency. Abridge employees know the domain cold; some software engineers and other-company guests won't know what Sgarbossa criteria or a Stanford Type A dissection are — the script defines jargon in-line, fast, so it doesn't stall the pacing.

---

## Before either take: reset the workspace

The app now **persists CDS actions, chart stage, and run state server-side** — it survives page reloads, not just window closes. That means a rehearsal run will leave "sent" actions greyed out and the patient already at the final stage. **Reset immediately before every take** (including between rehearsal and the real recording, and again right before walking on stage):

- Click the circular reset icon in the top bar (left of "MERIDIAN EMERGENCY"), **or**
- `curl -X POST http://localhost:8787/api/reset` (local) / the deployed `/api/reset` endpoint if presenting from the hosted URL

This clears Walter back to arrival, clears all sent CDS actions, and reloads.

**One more timing note:** the pre-visit agent now auto-starts the moment you open Walter's chart — before you even open the copilot window (~11s to replay). The Abridge AI CDS panel, however, needs no run at all — it's a live rules engine, not an LLM call, so it's already populated the instant the window opens. Land on the trackboard, then Walter's chart, with a beat or two of talking before opening the copilot window, so the narrative summary has time to finish quietly in the background.

---

## 60-Second Recorded Demo

No live Q&A, no room to recover from a fumbled click — this is the tightest possible cut. Voiceover is written to read in ~60s at a natural pace (~150 wpm); trim further in editing if needed, not by talking faster live.

**Setup:** reset workspace → land on trackboard, don't click yet → start recording → start voiceover.

| Time | Screen action | Voiceover |
|---|---|---|
| 0:00–0:07 | On the trackboard (Meridian ED — 3 patients waiting) | *"An ED doctor's patient chart, on average, is longer than a novel — and it's being rewritten while they're trying to read it."* |
| 0:07–0:15 | Click **Reyes, Walter** → chart opens on Chart Review. Quickly flip Encounters → Laboratory → Notes (fast clicks, ~2s each) | *"Everything about this chest-pain patient is in here. Finding the one fact that matters means clicking through all of it."* |
| 0:15–0:20 | Click the **sparkle icon** next to Walter's name | *"So we put an agent next to every chart."* |
| 0:20–0:33 | Copilot window open. Abridge AI CDS panel already live: point at the **sildenafil → nitrate contraindication** card. Click **💬 Alert Pharmacy — nitrate hold**, show the pre-filled message, send it (toast confirms) | *"It's already read the chart. Grounded twice — the exact chart fact, and the guideline that makes it standard of care. One click, and the action is sent."* |
| 0:33–0:45 | Click **Simulate: Delta card — 11:00**. Ribbon adds **Aortic Dissection — SUSPECTED** (amber). Point at the new top card (widened mediastinum) | *"New results land — the card updates itself. Troponin's critical, but look: a widened mediastinum. This isn't a heart attack. It's a dissection."* |
| 0:45–0:55 | Click **Simulate: CT results — 11:30**. Ribbon flips to **SURGICAL EMERGENCY** (red, pulsing). Click **💬 Update CV Surgery on-call** to show the pre-filled STAT message | *"Confirmed. Five actions, pre-filled, one click each — the clock starts before the doctor's even picked up the phone."* |
| 0:55–1:00 | Cut back to a wide shot / logo card | *"One specialty, built end to end. Abridge already supports fifty — this is the pattern for every one of them."* |

**Cut list if you're over time:** drop the tab-flipping in the first beat (go straight from trackboard to chart to sparkle icon); collapse the two Simulate beats into one (skip straight to CT results and mention "results evolve automatically" verbally instead of showing both stages).

---

## 3-Minute Live Demo

Full room, live clicking, recoverable if something's slow. Budget below is a target, not a hard stop — rehearse it once end-to-end with a stopwatch.

### Beat 1 — The problem (0:00–0:35)

Stand with the **physical copy of *Fahrenheit 451*** in hand before touching the laptop.

> **STEPHON:** "Shiv Rao's talked about three problems with clinical data: it's fragmented, it's hard to navigate, and you're often late to learn something — or you never learn it at all."
>
> **JOHN:** "Here's what that looks like in the ED. There's a 2024 study — *'Call Me, Doctor Ishmael'* — that found the average ED patient's chart, printed out, is about the length of *Fahrenheit 451*." *(hold up the book)* "Now imagine reading this cover to cover, in the ten minutes before you walk in the room — while someone's actively rewriting chapters as new labs and notes come in."

> *Presenter note: double-check the exact citation before you're in front of engineers who'll look it up — get the real title/venue locked down in rehearsal.*

### Beat 2 — The chart, unassisted (0:35–1:00)

Move to the laptop. On the **Meridian ED Track Board**.

> **JOHN:** "Three patients waiting. Let's take Walter — 68, chest pain, ESI 2."

Click **Reyes, Walter** → chart opens on **Chart Review**. Click through **Encounters → Laboratory → Notes → Media** (open the EMS run-sheet fax briefly).

> **JOHN:** "Every one of these tabs has something relevant to today buried in it, mixed in with forty years of stuff that isn't. Nobody has time to read all of it before walking in the room."

### Beat 3 — Meet the copilot, grounded twice (1:00–1:45)

Click the **sparkle icon** next to Walter's name in the left storyboard. Copilot window opens.

> **STEPHON:** "This didn't wait for us to ask — it started reading the chart the second we opened it. This window is draggable, it pins open, it collapses to an icon when you don't need it."

Point at the **Abridge AI** panel at the top (already populated — no run required).

> **STEPHON:** "This top panel is Abridge AI — clinical decision support, live the instant the chart opens, informed by trusted knowledge sources the way something like UpToDate would be. Every recommendation is grounded *twice*."

Point at the top card (sildenafil / nitrate contraindication). Click the **`chart:`** citation chip to expand it inline, then the **`rule:`** chip.

> **JOHN:** "Grounded once in the chart — sildenafil, taken eleven hours ago, right there in the EMS report. And grounded again in the reference — FDA labeling, PDE5 inhibitors and nitrates don't mix for twenty-four hours. Not a black box. I can see exactly why it fired."

Click **💬 Alert Pharmacy — nitrate hold**. Show the pre-filled message, send it.

> **JOHN:** "One click, and pharmacy already knows before anyone reaches for nitro."

Gesture to the collapsed **Chart summary** below.

> **STEPHON:** "Below that is the second system — the multi-agent chart-review pull, narrated in plain language, every line sourced back to the chart. Two different engines, two different jobs, working the same chart."

### Beat 4 — Time moves, the card moves with it (1:45–2:30)

> **JOHN:** "Chest pain doesn't sit still. Let's fast-forward."

Click **Simulate: Delta card — 11:00**.

> **JOHN:** "New labs, new imaging — landing automatically, no one re-running anything." *(point at ribbon)* "Aortic Dissection, suspected. Troponin's critical — that would normally point straight at a heart attack. But it caught a widened mediastinum on today's chest X-ray, and it's telling me: don't anchor on ACS yet, get the CT."

Click **Simulate: CT results — 11:30**.

> **JOHN:** "CT's back." *(ribbon flips red, pulsing)* "Stanford Type A dissection, confirmed. Surgical emergency."

Point at the cascading action cards.

> **JOHN:** "Five actions, all pre-filled from the CT read: message CV surgery, hold the apixaban and aspirin that are now a bleeding risk, type and cross blood, book the OR."

Click **💬 Update CV Surgery on-call** — show the pre-filled STAT message.

> **STEPHON:** "And if there are more than one — " *(point at the Execute all button)* " — send everything that's still pending in one click, all logged, all timestamped, none of it silent."

### Beat 5 — Teach it once, it stays taught (2:30–2:50)

Expand **Chart summary**. Hover any section (e.g. *Meds That Matter Now*) → click **Teach the agent**.

> **STEPHON:** "This is personalization, the same idea behind Abridge's ambient scribe — you tell it a preference once, in your own words —"

Type something like *"Show the last 5–10 vitals, not just the most recent"* → **Save preference**.

> **STEPHON:** "— and it's part of this agent's next version. Every future chart, for that physician, in that specialty, inherits it."

### Beat 6 — Close (2:50–3:00)

> **JOHN:** "One specialty, built end to end, top to bottom, real Epic APIs."
>
> **STEPHON:** "Abridge already runs fifty specialties in production. This is the shape the other forty-nine take."

---

## Reference: exact real copy in the app (don't paraphrase live)

- Trackboard title: **"ED Track Board (Meridian ED)"**
- CDS panel header: **"Abridge AI consulted — as of {time}"**
- Ribbon badges: **SUSPECTED** (amber, stage 1) → **SURGICAL EMERGENCY** (red, pulsing, stage 2)
- Stage buttons (bottom-left Demo Controls bar): **"◷ Simulate: Delta card — 11:00"** then **"◷ Simulate: CT results — 11:30"**
- Bulk actionable recommendations, in order they'll fire: **Alert Pharmacy — nitrate hold** (arrival) → **Update Cardiology on-call** (stage 1) → **Update CV Surgery on-call, Hold apixaban + ASA, Type & crossmatch — STAT, Emergent OR request** (stage 2) — 6 total, matching the **"Execute all (6)"** button once stage 2 lands
- Sent-action pill: greyed out, **"{label} — sent {time}"**, persists across reload until the workspace is reset
- Teach popover copy: **"How should '{section}' work for you in future runs? Your feedback becomes part of this agent's next version."**

## If asked (Q&A prep)

- **"Is the narrative card actually live-generated?"** — Yes, every card was produced by the real multi-agent Claude pipeline; we replay the recording for stage-timing consistency in a demo setting. Flip one env var and it calls the live API in ~90s. The Abridge AI CDS panel above it is never cached — it's a deterministic rules match, live every time, independent of whether the narrative agent has run at all.
- **"Is the clinical logic real?"** — Every rule/recommendation is our own authored knowledge base, citing real guideline lines (ACC/AHA, AATS, FDA labeling) the way a production CDS system would — fully inspectable via the `rule:` chips, fully editable, nothing sends without a click.
- **"Does teach-the-agent affect the CDS rules panel too, or just the narrative summary?"** — Today, teach-the-agent personalizes the narrative chart-review agent's prompt (versioned, e.g. v1.0 → v1.1). The rules-based CDS panel is deterministic by design — that's a deliberate product question worth discussing, not an oversight.
