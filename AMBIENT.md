# Ambient motion — the contracts, what moves, and what is queued

Scenes have things in them that move on their own: a train round the Horseshoe, a
rocket off Pad 39, a tractor in the Kansas wheat. None of it is gameplay. **The
crossing is the game**; this is the world going about its business behind it.

**This file is not part of any art drop.** `SCENE_GUIDE.md` and `SCENE_ROADMAP.md`
come from the scene collaborator and get overwritten every time a drop lands, so
the queue below lives here instead, where it survives.

---

## The one rule

Motion is always **gate-blind**. Nothing here reacts to the crossing, waits
for it, or is blocked by it. If a thing needs to know about the gate it is not
ambient motion, it is gameplay, and it belongs somewhere else.

---

## How to add some — the art tags itself, the engine drives it

`scene.js` never learns a scene by name. It looks for classes, and a scene that
does not have them gets nothing. To animate something, tag it in
`tools/gen-scenes.py` (or in `colorado.svg`, which is hand-authored) and re-run
the generator, `inline-assets.py`, and `check-scenes.py`.

| Contract | Tag it | Used by |
|---|---|---|
| **Shuttle** — travels between two x, turns at each end | `.cc-el-train` / `.cc-plane` / `.cc-ship` with `data-run` / `data-fly` / `data-sail` = `"from,to,y"`. Optional `data-nose="-1"` if the art is drawn nose-LEFT, and `data-scale` if it is drawn at another size. | Chicago L, Chicago plane, both Duluth boats, the Seattle ferry, the New Orleans riverboat |
| **Balloons** — drift, bob and burn | `.cc-balloon` with `data-i` `data-x` `data-y` `data-s` `data-maxy`. Drift amplitude scales with `data-s` so the near ones swing and the far ones barely stir; `data-maxy` is the lowest the basket may go, computed for ±90px either side of that balloon's OWN x — so the drift oscillates rather than wrapping. Burners are any `.cc-flame` in a scene that has no `.cc-rocket`. | Albuquerque |
| **Launch** — one balloon at a time leaves the field | `#cc-launch-N` (ids, so namespaced — found by substring). The engine reads each pad's own `translate`/`scale` as the place to come home to. Each goes in turn — idle, burner up, then a smoothstep climb that SHRINKS her to 0.3 — and STAYS gone until all of them have gone, at which point the whole field fades back together. Her ground shadow is a tagged sibling, `.cc-launch-shade` with `data-pad`, and fades out over the first third of the climb. **The id must wrap the balloon and nothing else** — see the trap below. | Albuquerque |
| **Falling water** — a sheet that never stops | `.cc-fall` with `data-band` (the tile height) and `data-secs`. The art draws a band of streaks that TILES vertically and emits it twice, the second copy one band above the first; the engine slides the pair down by exactly one band and it loops with no seam. Clip it to the BROKEN part of the sheet, not the whole face — streaks scrolling over the glassy lip stop it reading as an edge. `.cc-foam` groups churn out of step at the base. | Quechee |
| **Route** — stops in order, dwelling, looping | `.cc-route` with `data-route` = stops separated by spaces: `"x"`, `"x:dwell"` (seconds held) or `"@x"` (jump there instantly — only ever off-screen, so a thing can leave one side and reappear on the other without crossing what is between). Plus `data-y`, `data-speed`, `data-scale`, `data-nose`. | the Kansas tractor |
| **Cable** — chairs/cabins climbing and returning | `.cc-cablecar` with `data-cable="x0,y0 x1,y1"` and `data-lane-dy`; children `.cc-chair` with `data-t` and `data-lane` | Gatlinburg SkyLift, Colorado gondola |
| **Rotator** — a wheel whose cars stay level | `.cc-ferris` with `data-secs`; children `.cc-pod` with `data-px`/`data-py` | Chicago Ferris wheel |
| **Path follower** — a consist walking a drawn centreline | `<path id="curve-path">` (and it must be in `KEEP_IDS`) | Horseshoe Curve |
| **Rail arc** — a short train on a quadratic | `.cc-scenery-train` with `data-rail="x0,y0 cx,cy x1,y1"` and `data-lift` | Colorado trestle |
| **Launch** — sit, ignite, climb out, repeat | `.cc-rocket` with `data-pad-dy`, plus `.cc-flame`, `.cc-rocket-glow`, `.cc-rocket-smoke`, and an empty `.cc-rocket-puffs` with `data-pad` | Cape Canaveral |
| **Road junction** — traffic turns off instead of fading | `.cc-road-exit` with `data-exit="nearEdgeY,farEdgeY,junctionX"` | Crater Lake |
| **Cog railway** — one train up a single track and back down | `<path id="cog-path">` (base at length 0, summit at the end) plus a drawn `#cog-train-a` to clone. Scale is the art's rule, `1 − 0.62·t`. | Mount Washington |
| **Coaster** — a train winched up a lift hill, then gravity | `<path id="coaster-path-*">` (foot of the lift to the last valley). No depth scaling; the crest is found by walking the path, and speed after it grows with how far the train has fallen below it. | Cedar Point |
| **Spinner** — a wheel turning about its own hub | `.cc-spin` with `data-secs` and `data-cx`/`data-cy` (the hub, in the vehicle's OWN local coordinates, so it survives its parent being moved or mirrored). Unlike `.cc-ferris` it keeps nothing level — turning is the point. | the New Orleans paddlewheel |
| **Swarm** — a cloud that boils | `.cc-swarm` on a parent whose direct `<g>` children are opacity bands with the individuals **interleaved** between them. The engine drifts the bands against each other, so every individual moves relative to its neighbours. | the Austin bats |
| **Chase** — bulbs lighting in sequence | `.cc-chase` with `data-rate` (bulbs per second) on a group of bulb elements | the Las Vegas neon |
| **Where the road ends** | `class="cc-road"` on the carriageway polygon — the engine reads its far edge | every scene |

Two traps, both already paid for once:

- **Whatever the engine moves, the id must wrap that and ONLY that.** The
  Albuquerque pads originally had the balloon's ground shadow and a crew member
  with a fan inside the same group, because they belong to the pitch. So when a
  balloon launched it carried both into the sky — a shadow and a man hanging in
  mid-air under the basket. Anything belonging to the ground has to be a SIBLING
  of the thing that leaves the ground, not a child of it.
- **A thing that scrolls has to tile.** The Quechee streaks were laid out at
  fractions of the drop, which looks right standing still and cannot loop — a
  tile has to meet itself. Placing them inside a fixed band instead is what makes
  the seamless two-copy slide possible at all.
- **A shadow belongs to the ground, not to the thing that left it.** Leaving the
  launch balloons' shadows on the pitch after they had gone was the tell — there
  was nothing up there casting them. They fade over the first third of the climb
  and come back with the balloon.
- **Empty the set before refilling it.** Putting each balloon back before the
  next one left meant the pitch was never actually empty, so it read as three
  balloons taking turns rather than as an ascension. All three go, then all
  three return.
- **A rising thing should shrink.** The Albuquerque launch balloons are 86×127px
  on the pitch. Carried up the frame at that size one would sit on top of the
  crossing; shrinking her to 0.3 over the climb is both what a balloon going away
  from you actually does and what keeps the composition intact.
- **A mirrored thing's overhang swaps sides.** The tractor reaches 62 behind its
  origin and 25 ahead; turn it round and the trailer is 62 *ahead*. A stop that
  clears an obstacle facing one way can put the load straight through it facing
  the other, so clear it by the longer of the two.
- **The Cog Railway engine never runs round.** It stays below the coach in both
  directions — pushing up, braking down — and on Mount Washington the coach is
  not even coupled to it, just resting against it with its own brakes, so that
  nothing uphill of the engine depends on a coupling that could fail. The
  locomotive also faces UPHILL: chimney and smokebox at the end against the
  coach, cab and tender at the downhill end. Both were drawn back to front once
  and look plausible either way, so check a photograph before changing them.
- **Rotating an upright vehicle by more than 90° turns it upside down.** Mount
  Washington's cog line climbs up and to the LEFT — heading about −125° — and
  rotating by that hangs the train under the rail with its roof pointing
  downhill. Turn to the *downhill* angle and mirror instead: same direction of
  travel, right way up. The engine does this for any heading past ±90°.
- **The engine rewrites the whole `transform` every frame.** Anything baked into
  it in the markup — a `scale`, a `rotate` — is thrown away the moment the thing
  moves. Declare it (`data-scale`) instead.
- **Ids are namespaced per scene by `inline-assets.py`; classes are not.** Use a
  class for anything the engine looks up. An id kept unnamespaced collides across
  the several scenes the game keeps mounted at once — that is what turned
  Colorado's road green.
- **When the art hands you an id anyway, match its SUFFIX.** The namespace is a
  prefix (`cog-path` → `s-mt-washington-cog-path`), so `[id$="cog-path"]` finds it
  with no `KEEP_IDS` entry and therefore no way to collide — and because the
  lookup runs on the scene's own root, a second scene using the same name would
  still be safe. Prefer this to adding to `KEEP_IDS`, which is the mechanism that
  broke Colorado. `curve-path` predates the trick and is still in `KEEP_IDS`.

---

## What moves today (17 scenes)

| Scene | What |
|---|---|
| Rocky Mountains | Georgetown Loop train on the trestle · gondola up the peak |
| Chicago | Ferris wheel · the L along the viaduct · airliner over the lake |
| Cape Canaveral | rocket launches off Pad 39 with an exhaust column |
| Gatlinburg | SkyLift chairs up the hillside |
| Horseshoe Curve | 25-wagon freight round the bowl |
| Crater Lake | traffic turns onto Rim Drive |
| Wheat Country | the tractor works both fields, calls at the grain elevator, and turns at the verge — it never crosses the road |
| Duluth | a thousand-footer crosses the lake · a tug works the canal, under the span |
| Quechee | the falls pour over the dam · the boil churns at the base |
| Detroit | **not ambient** — every other train stops and shunts a loaded auto-rack off the siding. See below. |
| Albuquerque | nineteen balloons drift and bob in parallax · ten burners pulse out of step · the three on the field go up one at a time ~20s apart, then all come back together |
| Mount Washington | the cog train climbs to the summit, waits, and comes back down — engine always below the coach, pushing |
| Cedar Point | three-car trains on both coasters — slow up the lift, fast down the drop |
| Seattle | the ferry crosses Elliott Bay and turns at the houseboat moorings |
| New Orleans | the sternwheeler works the Mississippi, paddlewheel turning |
| Austin | the bat column boils out from under the Congress Avenue Bridge |
| Las Vegas | the marquee bulbs chase round every sign on the Strip |

---

## Queued, best first


**1. Moab — the jeep.** Moab is about offroading and the jeeps are drawn. Shuttle
along the slickrock track. (Listed as "skip" in an earlier pass — wrong call, a
vehicle is exactly what lands with the audience.)

**2. Yellowstone — the geyser erupts**, and the bison amble. The rocket's plume
machinery is most of the eruption already.

**3. Bluegrass — a thoroughbred canters** the paddock. Shuttle.

**4. Oʻahu — an outrigger on the reef.** Shuttle.

**5. Denali — the aurora shimmers.** Cheap, atmospheric, and it is the only
scene where it would read.

---

## Detroit is the exception: this one IS the train

Everything else in this file is scenery. The Detroit shunt is not — it is the
gameplay train doing something, and it lives in `updateTrain`, not here. It is
written up in this file only because this is where anyone looking for "what
moves" will come.

    the train runs in and brakes to a stand
    a loaded auto-rack rolls down off the siding onto the main line
    it settles on the back of the train
    the train pulls away one wagon longer

A scene opts in by having `#cc-autorack-N` groups on a siding; every other place
still runs a train straight through. Every OTHER train shunts — always would
make the place feel like a cutscene, never would leave a child waiting on a coin
flip for the best thing in the scene.

Two rules it must keep:

- **It must not touch the child's train.** The extra wagon goes in as a
  scene-local extra and is never written to `CC.trains`, so it cannot follow them
  to the next place or survive a reload. A location does not get to redecorate
  what they built.
- **It must not couple to the gate.** Same rule as everything else here. The
  child can raise the gate mid-shunt and nothing cares.

The wagon that rolls down is the CONSIST'S OWN element, animated from the siding
to its coupling slot — not the scene's artwork with a swap at the end. Swapping
at the end means matching two different drawings pixel for pixel at the one
moment anybody is looking at them. This way there is a single art change, at the
START of the roll, at the same place and the same size (worked out from the two
bounding boxes, not guessed), while the wagon is small and far away.

---

## Duluth: the bridge itself does not lift, and that was on purpose

The first attempt raised the span. It was rejected, correctly: **a grey rectangle
going up and down does not read as a bridge lifting.** The reason is structural,
not a tuning problem — the bridge lives in the `water` layer, which is drawn
*before* `road`, so the girder can rise but **the roadway on it cannot**. You get
a deck detaching from the road it carries.

Making it work needs the art redrawn, and that is a request for the scene side,
not something the engine can fix:

> **Duluth lift span, spec.** Draw the deck and the roadway it carries as ONE
> group, `.cc-lift-span`, placed *after* the road so it can take the tarmac with
> it. Leave a gap patch (water, or the road's own dark underside) behind it, so
> that when the group rises the hole it leaves looks like a hole and not like a
> missing shape. The far crossing gate would then want to sit between the two
> road ends rather than across them.

Even with that, **do not couple the crossing gate to the bridge.** Those two
buttons are the one thing a three-year-old has learned mean *the train is
coming*; making them also mean *a boat is coming* takes that away. If the span
ever lifts, it lifts on its own timer, gate-blind like everything else here.

---

Below the line, in rough order: Kansas City's fountain, traffic on the Brooklyn
Bridge, a boat in San Francisco Bay.

**There is no cap on how many scenes move.** There used to be a
twelve-to-fourteen limit in this file, on the theory that too much motion would
pull attention off the crossing. In practice the animations turned out to be
half of why the places are worth visiting, so the call is the maintainer's and
is made scene by scene. Some places are still better still — the Grand Canyon
is about not moving — but that is a judgement about *that* place, not a budget.
