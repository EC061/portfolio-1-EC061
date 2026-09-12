# Demo 2 — video script

**Target: 5:00. Hard limits 3:00–6:00.**

**Format is mandatory and is a gate:** two simultaneous views for the
whole video — the headset view (Quest recording or cast) **plus** a
live-action inset of you actually swinging. Picture-in-picture must be
maintained throughout, not just at the start. Without a compliant video
the demo scores zero.

Set the inset up before you record anything. A phone on a tripod behind
and to the side, framing your whole body and the play space, composited
as a corner inset over the headset capture.

---

## Beat sheet

### 0:00 – 0:20 · Cold open
**On screen:** you, in the headset, taking one good swing.
**Say:** what sport, what the training environment is for, and that it is
a trainer rather than a game. One sentence.

### 0:20 – 1:50 · The four physics systems — the core of the grade
Walk them in the order the ball travels. For each one, name the system,
say what forces are acting, and give the number.

1. **Launch.** What sets exit speed, angle and spin. Show the readout.
2. **Flight.** Gravity, drag, Magnus. Say the drag coefficient and where
   it came from. Say what the Magnus force actually is — a force
   perpendicular to both the velocity and the spin axis — and then
   *show it*: launch the same speed with and without spin and let the
   viewer watch the two paths diverge.
3. **Contact.** The implement is kinematic, parented to the controller,
   and its velocity comes from tracked poses. Say the coefficient of
   restitution and the friction model at impact.
4. **Surface.** Bounce, roll, the friction that couples them, and where
   one becomes the other.
5. *(if built)* wind.

**Then the timestep.** State the fixed timestep you chose and why, and
say how you stopped the ball tunnelling through the bat — continuous
collision detection, or a step small enough that the ball moves less than
its own radius per step. Name which.

### 1:50 – 2:30 · Validation, with a measurement on screen
This is what separates "meets" from "exceeds". Do not narrate it, measure
it.

Pick one and do it live:
- time from release to the plate against the published figure
- lateral break of a curve over the full flight
- carry distance for a known launch speed and angle

Say the published number, show your measured number, and say the error.
If it is off, say it is off and say why you think so. An honest 8% error
with a stated cause beats a silent claim.

### 2:30 – 3:20 · Tracked interaction and the training loop
**On screen:** several reps in a row, with the inset showing your body.

**Say:**
- headset and controllers are the entire interface; no locomotion, no
  teleport, no artificial movement
- how implement velocity is derived from poses, and what you do about
  tracking noise (filtering? frames of history?)
- the loop: what feedback appears after each rep, what the target zones
  are, how the session score accumulates, and why that makes it
  practisable

### 3:20 – 3:50 · Audio
Say **spatialised**, and prove it: turn your head mid-approach so the
ball's sound moves across the stereo field in the capture. Name the three
audio layers — approach, impact, ambience — and say what spatialiser you
used.

### 3:50 – 4:20 · (Graduate students only) the study
One short paragraph. What you logged, how many participants, and the one
change the data suggested. Reference `Demo*/Study/` by name.

### 4:20 – 5:00 · What you verified, what is broken
- **Verified:** the measurement you did on camera, plus anything else you
  checked (no tunnelling at max speed, restitution against a drop test).
- **Broken:** say it plainly. Tracking noise on fast swings, a physics
  regime you did not model, a sport parameter you could not source.

---

## Pre-upload checklist

- [ ] Picture-in-picture maintained for the **whole** video
- [ ] All four physics systems named and shown
- [ ] Drag **and** Magnus discussed, with spin shown changing the path
- [ ] Fixed timestep value stated, with the reason
- [ ] Tunnelling prevention named (CCD or step size)
- [ ] A real measurement against a published number, on screen
- [ ] Implement velocity from tracked poses, said out loud
- [ ] Training loop shown across several reps with feedback
- [ ] Spatialised audio demonstrated by moving your head
- [ ] Sources cited for the parameters you quote
- [ ] (6830) the study mentioned
- [ ] "What I verified" and "what needs fixing"
- [ ] 3:00–6:00, on YouTube, played back signed-out
- [ ] APK attached to a GitHub Release with install notes, and linked
