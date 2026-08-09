# Ambient motion — the contracts, what moves, and what is queued

Scenes have things in them that move on their own: a train round the Horseshoe, a
rocket off Pad 39, a tractor in the Kansas wheat. None of it is gameplay. **The
crossing is the game**; this is the world going about its business behind it.

**This file is not part of any art drop.** `SCENE_GUIDE.md` and `SCENE_ROADMAP.md`
come from the scene collaborator and get overwritten every time a drop lands, so
the queue below lives here instead, where it survives.

---

## The rule that keeps this from ruining the game

Every scene twitching is noise, not delight, and the gate is what the child is
supposed to be watching. **Cap it at roughly twelve to fourteen scenes with
motion and leave the rest quiet.** Some places are partly *about* stillness — the
Grand Canyon is the obvious one.

Motion is also always **gate-blind**. Nothing here reacts to the crossing, waits
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
| **Shuttle** — travels between two x, turns at each end | `.cc-el-train` / `.cc-plane` / `.cc-tractor` / `.cc-ship` with `data-run` / `data-fly` / `data-drive` / `data-sail` = `"from,to,y"`. Optional `data-nose="-1"` if the art is drawn nose-LEFT, and `data-scale` if it is drawn at another size. | Chicago L, Chicago plane, Kansas tractor, both Duluth boats, the Seattle ferry, the New Orleans riverboat |
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

## What moves today (14 scenes)

| Scene | What |
|---|---|
| Rocky Mountains | Georgetown Loop train on the trestle · gondola up the peak |
| Chicago | Ferris wheel · the L along the viaduct · airliner over the lake |
| Cape Canaveral | rocket launches off Pad 39 with an exhaust column |
| Gatlinburg | SkyLift chairs up the hillside |
| Horseshoe Curve | 25-wagon freight round the bowl |
| Crater Lake | traffic turns onto Rim Drive |
| Wheat Country | tractor and grain trailer working the field |
| Duluth | a thousand-footer crosses the lake · a tug works the canal, under the span |
| Mount Washington | the cog train climbs to the summit, waits, and comes back down |
| Cedar Point | three-car trains on both coasters — slow up the lift, fast down the drop |
| Seattle | the ferry crosses Elliott Bay and turns at the houseboat moorings |
| New Orleans | the sternwheeler works the Mississippi, paddlewheel turning |
| Austin | the bat column boils out from under the Congress Avenue Bridge |
| Las Vegas | the marquee bulbs chase round every sign on the Strip |

---

## Queued, best first

> **We are at the cap.** Fourteen scenes move; the rule at the top of this file
> says twelve to fourteen. Everything below would take it past that, so the next
> one is a judgement call and not just the next item on a list — pick the one
> that earns it, or decide the rule was too tight and say so here.

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

**Deliberately left still:** Houston (the shuttle on the 747 is a museum exhibit
and is *meant* to sit), Washington DC, Miami Beach, Los Angeles, Grand Canyon.
