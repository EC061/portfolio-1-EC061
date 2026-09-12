# Demo 3 — video script

**Target: 4:30. Hard limits 3:00–6:00.**

**Format is mandatory:** headset view **plus** a live-action inset of your
hands and body, picture-in-picture throughout. Without it the demo scores
zero.

The spine of this video is **one complete, uninterrupted run of the
procedure**, with two deliberate mistakes in it. Plan the run before you
record — which step you will get wrong, and when.

---

## Beat sheet

### 0:00 – 0:20 · Cold open
**On screen:** hands already at the table, picking up the first part.
**Say:** what the procedure is, where it comes from (cite it out loud),
and how many steps it has.

### 0:20 – 0:50 · The state machine, named
Before you run it, explain the model. This is the highest-value 30
seconds in the video.

**Say:**
- the procedure is *n* explicit states, and the system always knows which
  one it is in
- what a prerequisite is, in this procedure, concretely
- what happens on a wrong part and what happens on a right part at the
  wrong time — these are different failures and you should say so
- that there is a completion state and a reset

### 0:50 – 2:30 · The full run, first time through, correctly
Work the procedure at a natural pace. As you go, narrate **why** each
step is gated:

- point at the in-world guidance and say it follows the current state
- when a part snaps into place, say it is a snap/constraint, not a free
  drop, and say what defines the tolerance
- when you use the tool or the two-handed operation, call it out
- when you hit the **constrained motion** — the hinge, screw, slider or
  latch — stop and dwell on it. Say what degree of freedom is allowed and
  what is locked, and demonstrate by trying to move it the wrong way.

### 2:30 – 3:10 · Break it on purpose, twice
This is what demonstrates the logic actually exists.

1. **Wrong part.** Pick up a component that belongs to a later step. Let
   the error feedback fire. Say what the state machine did — did it
   refuse, warn, or let you and then flag it?
2. **Right part, wrong time.** Do a legitimate step out of order. Show
   that this is detected as a *different* failure from the first one.

Then recover, and say whether recovery is a designed path or a reset.

### 3:10 – 3:40 · Manipulation details
**On screen:** deliberately use both hands at once.

**Say:**
- held objects are kinematic in hand, and why (a rigidbody in a hand
  fights the tracking)
- how a placement decides it is close enough to snap
- what happens if you release something mid-air

### 3:40 – 4:00 · Completion and reset
Finish the procedure. Show the completion state. Press reset and show it
returns to step one cleanly — including anything you moved.

### 4:00 – 4:30 · What you verified, what is broken
- **Verified:** you ran the full sequence end to end; both error classes
  fire; reset restores every object, not just the counter.
- **Broken:** grab jitter, a snap tolerance that is too forgiving, a step
  where the ordering constraint is weaker than the real procedure, hand
  tracking you did not test.

---

## Pre-upload checklist

- [ ] Picture-in-picture maintained throughout
- [ ] The procedure's source cited out loud and on screen
- [ ] Six or more steps, counted out loud
- [ ] The state machine explained **before** the run
- [ ] One complete correct run, uninterrupted
- [ ] Wrong-**part** error shown and named
- [ ] Right-part-**wrong-time** error shown and named as different
- [ ] Both hands used simultaneously, on camera
- [ ] Snapping / placement constraint called out
- [ ] Tool interaction **or** two-handed operation shown
- [ ] Constrained motion (hinge/screw/slider/latch) demonstrated, with
      the locked axes described
- [ ] In-world guidance shown following the current step
- [ ] Completion **and** reset both shown
- [ ] "What I verified" and "what needs fixing"
- [ ] 3:00–6:00, on YouTube, played back signed-out
- [ ] Public URL or Release linked in both READMEs
