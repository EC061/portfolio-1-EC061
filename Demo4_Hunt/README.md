# Demo 4 — Scavenger Hunt (WebXR or Unity)

> **Status: not started.** This folder is scaffolding — the brief, the
> plan, and the decisions still open. Everything marked TODO is genuinely
> outstanding.

| | |
|---|---|
| **Live demo / Release** | <!-- TODO: public WebXR URL, or APK Release link --> |
| **Video** | <!-- TODO: YouTube link --> |
| **Stack** | <!-- TODO: WebXR or Unity --> |
| **World** | <!-- TODO: maze / building / campus / warehouse / cave --> |

---

## What this has to be

A **large navigable environment** with five hidden targets among twenty
convincing distractors. The graded subject is **locomotion and comfort**,
not the world — the world exists to give the locomotion something to do.

## What it must demonstrate

### World and search

- Multi-room or multi-region layout with **landmarks** you can navigate
  by. If the player has to rely on a minimap, the layout has failed.
- **Five targets among twenty similar-looking distractors**, close enough
  in appearance that finding one requires actually inspecting it.
- Progress display: found, remaining, elapsed time.
- Optionally: a timed score, and signage that becomes learnable.

### Two distinct locomotion systems — the graded core

Switchable **in-app**, and each one has to be usable for the entire hunt
on its own. Two variants of the same mechanism count as one system, so
"teleport" and "teleport with a longer arc" is one, not two.

Pairs that clearly count as two:

- teleport + smooth joystick locomotion
- arm-swinging + dash
- grab-the-world + climbing

### Comfort features — all required, in a menu

- **Vignette during smooth motion** (tunnelling)
- **Snap turning**, with a smooth-turn option
- **Teleport fade**
- **Adjustable speed**
- **View reset**
- Optionally: seated mode, or height calibration that survives a restart

The video has to explain these **in terms of sensory mismatch** — the
vestibular system reporting no motion while the visual system reports a
lot — not as a list of options.

---

## Decisions still open

<!-- TODO: answer these before building. -->

1. **Which two locomotion systems**, and why those two for this world?
   The rubric asks you to justify the pairing against the layout: a tight
   maze and an open warehouse want different things.
2. **How are targets and distractors differentiated?** It has to be a
   real inspection task, not a colour swap.
3. **What are the landmarks**, and can you navigate the space with the
   HUD off?
4. **Comfort defaults.** Which settings are on for a first-time user?

## Controls

<!-- TODO: both locomotion schemes, the switch, and every comfort toggle. -->

## Sources

<!-- TODO: third-party assets with licences, or "none". -->

## Known issues

<!-- TODO -->
