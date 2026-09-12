# Study — instrumented demo (CSCI 6830)

> **Status: planned, not run.** The logging described here is not yet
> wired into the demo and no participants have been recorded. This file
> is the design; `ANALYSIS.md` and `data/` are the deliverables.

The graduate requirement is to instrument **one** of the four demos with
performance logging, deploy it to **at least five** people, and analyse
what comes back. This folder sits inside `Demo1_Ride` because that is the
demo that exists and because it is the easiest of the four to put in
front of five people — it is a URL, not an APK sideload.

---

## What gets logged

The brief asks for **three or more meaningful metrics per participant**,
with **timestamps on every event** so a whole session can be
reconstructed afterwards. For a carnival ride the interesting question is
comfort versus motion, so the metrics are chosen to let a comfort rating
be explained by what the participant actually did.

| # | Metric | Unit | Why it is meaningful |
|---|---|---|---|
| 1 | Comfort rating per rider view | 1–5 | The dependent variable. Prompted once, after ≥20 s in a rider view. |
| 2 | Dwell time per view | s | Distinguishes "rated it 2 after 90 seconds" from "rated it 2 and bailed". |
| 3 | Ride speed at the moment of rating | × | The one setting that directly scales angular velocity, so the one most likely to drive discomfort. |
| 4 | Median frame time during that view | ms | Controls for the confound: a low rating on a 25 fps laptop is a performance result, not a comfort result. |
| 5 | View-switch count and order | — | Reveals whether people fled a ride or explored. |
| 6 | Session length, device, GPU string | s / text | Cohort description. |

### Event schema

Every event is one JSON object, appended in order:

```json
{
  "session": "s07",
  "t": 48213,
  "event": "view_change",
  "from": "midway",
  "to": "wheel",
  "speed": 1.0,
  "night": 0.0,
  "quality": "medium",
  "fps_median": 118.4
}
```

- `session` — participant number only. **No names, no emails, no IP.**
- `t` — milliseconds since page load (`performance.now()`), so ordering
  and durations survive without a wall clock.
- `event` — one of `session_start`, `view_change`, `setting_change`,
  `comfort_rating`, `fps_sample`, `session_end`.

`session_start` additionally carries `{ ua, gpu, dpr, screen }` from
`WEBGL_debug_renderer_info`, which is what makes metric 4 interpretable.

## How it is collected

Simplest thing that works and stays honest about privacy:

1. The page buffers events in memory and mirrors them to
   `localStorage`, so a dropped connection loses nothing.
2. On `session_end` (and on `visibilitychange` → hidden) it `POST`s the
   buffer with `navigator.sendBeacon` to a single endpoint.
3. The endpoint appends newline-delimited JSON to a file. Any of the
   options the brief lists would do — a tiny endpoint on the same host
   that already reverse-proxies the container is the least moving parts,
   since `docker-compose.yml` here is already built to sit behind one.

Nothing is logged until the participant clicks through a one-screen
notice saying what is recorded and that it is identified by number only.

## Participants

- Minimum **five**, identified as `s01`…`sNN` and nothing else.
- Classmates and a Discord call are both explicitly acceptable.
- No consent forms are required in this classroom context, and the data
  is not for research or publication.

## Deliverables

| File | Contents |
|---|---|
| `data/events.ndjson` | raw log, one JSON object per line |
| `data/participants.csv` | the per-participant metric table |
| `ANALYSIS.md` | one or two charts, plus a one-page summary |

`ANALYSIS.md` must end with **one proposed change to the demo, cited
against the data** — not a general observation. Something of the shape
"drop the default ride speed from 1.0× to 0.8×, because four of five
participants rated the teacup view ≤2 at speeds above 1.4× while none did
below it."

## How this is scored

| Criterion | Points | What full marks needs |
|---|---|---|
| Logging | 4 | three metrics, reproducible, **and timestamped events** |
| Participants | 2 | five or more, numbered |
| Analysis | 4 | metrics, charts, findings, **and a change proposal cited to the data** |

Also: the demo's video has to **mention the study briefly**. It is one
sentence, and it is free marks.
