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
| **Shuttle** — travels between two x, turns at each end | `.cc-el-train` / `.cc-plane` / `.cc-tractor` with `data-run` / `data-fly` / `data-drive` = `"from,to,y"`. Optional `data-nose="-1"` if the art is drawn nose-LEFT, and `data-scale` if it is drawn at another size. | Chicago L, Chicago plane, Kansas tractor |
| **Cable** — chairs/cabins climbing and returning | `.cc-cablecar` with `data-cable="x0,y0 x1,y1"` and `data-lane-dy`; children `.cc-chair` with `data-t` and `data-lane` | Gatlinburg SkyLift, Colorado gondola |
| **Rotator** — a wheel whose cars stay level | `.cc-ferris` with `data-secs`; children `.cc-pod` with `data-px`/`data-py` | Chicago Ferris wheel |
| **Path follower** — a consist walking a drawn centreline | `<path id="curve-path">` (and it must be in `KEEP_IDS`) | Horseshoe Curve |
| **Rail arc** — a short train on a quadratic | `.cc-scenery-train` with `data-rail="x0,y0 cx,cy x1,y1"` and `data-lift` | Colorado trestle |
| **Launch** — sit, ignite, climb out, repeat | `.cc-rocket` with `data-pad-dy`, plus `.cc-flame`, `.cc-rocket-glow`, `.cc-rocket-smoke`, and an empty `.cc-rocket-puffs` with `data-pad` | Cape Canaveral |
| **Lift bridge** — a span that rises, coupled to a ship | `.cc-lift-span` with `data-lift`, plus `.cc-canal-boat` with `data-sail="from,to,y"`. One controller runs both so the span is always up before the ship arrives. | Duluth |
| **Road junction** — traffic turns off instead of fading | `.cc-road-exit` with `data-exit="nearEdgeY,farEdgeY,junctionX"` | Crater Lake |
| **Where the road ends** | `class="cc-road"` on the carriageway polygon — the engine reads its far edge | every scene |

Two traps, both already paid for once:

- **The engine rewrites the whole `transform` every frame.** Anything baked into
  it in the markup — a `scale`, a `rotate` — is thrown away the moment the thing
  moves. Declare it (`data-scale`) instead.
- **Ids are namespaced per scene by `inline-assets.py`; classes are not.** Use a
  class for anything the engine looks up. An id kept unnamespaced collides across
  the several scenes the game keeps mounted at once — that is what turned
  Colorado's road green.

---

## What moves today (9 scenes)

| Scene | What |
|---|---|
| Rocky Mountains | Georgetown Loop train on the trestle · gondola up the peak |
| Chicago | Ferris wheel · the L along the viaduct · airliner over the lake |
| Cape Canaveral | rocket launches off Pad 39 with an exhaust column |
| Gatlinburg | SkyLift chairs up the hillside |
| Horseshoe Curve | 25-wagon freight round the bowl |
| Crater Lake | traffic turns onto Rim Drive |
| Wheat Country | tractor and grain trailer working the field |
| Duluth | the Aerial Lift Bridge raises for a thousand-footer in the canal |

---

## Queued, best first

**1. Seattle — the ferry.** Already drawn. Pure shuttle, no new code. The
cheapest real win on the list.

**2. New Orleans — the riverboat.** Shuttle for the hull, rotator for the
paddlewheel. Two existing contracts, no new mechanism.

**3. Austin — the bats.** The scene's whole identity is a million bats off the
Congress Avenue Bridge at sunset, and they do not move. The one item here that
wants genuinely new code — a small swarm.

**4. Las Vegas — the neon.** The only night scene in the set and its signs do not
flash. A blink cycle on tagged elements; very cheap.

**5. Moab — the jeep.** Moab is about offroading and the jeeps are drawn. Shuttle
along the slickrock track. (Listed as "skip" in an earlier pass — wrong call, a
vehicle is exactly what lands with the audience.)

**6. Yellowstone — the geyser erupts**, and the bison amble. The rocket's plume
machinery is most of the eruption already.

**7. Bluegrass — a thoroughbred canters** the paddock. Shuttle.

**8. Oʻahu — an outrigger on the reef.** Shuttle.

**9. Denali — the aurora shimmers.** Cheap, atmospheric, and it is the only
scene where it would read.

Below the line, in rough order: Kansas City's fountain, traffic on the Brooklyn
Bridge, a boat in San Francisco Bay.

**Deliberately left still:** Houston (the shuttle on the 747 is a museum exhibit
and is *meant* to sit), Washington DC, Miami Beach, Los Angeles, Grand Canyon.
