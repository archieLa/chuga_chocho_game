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
| **Shuttle** — travels between two x, turns at each end | `.cc-el-train` / `.cc-plane` / `.cc-ship` with `data-run` / `data-fly` / `data-sail` = `"from,to,y"`. Optional `data-nose="-1"` if the art is drawn nose-LEFT, `data-scale` if it is drawn at another size, and `data-speed` to override the per-class default — two boats in one bay at the same speed read as one mechanism. | Chicago L, Chicago plane, both Duluth boats, the Seattle ferry, the New Orleans riverboat |
| **Balloons** — drift, bob and burn | `.cc-balloon` with `data-i` `data-x` `data-y` `data-s` `data-maxy`. Drift amplitude scales with `data-s` so the near ones swing and the far ones barely stir; `data-maxy` is the lowest the basket may go, computed for ±90px either side of that balloon's OWN x — so the drift oscillates rather than wrapping. Burners are any `.cc-flame` in a scene that has no `.cc-rocket`. | Albuquerque |
| **Launch** — one balloon at a time leaves the field | `#cc-launch-N` (ids, so namespaced — found by substring). The engine reads each pad's own `translate`/`scale` as the place to come home to. Each goes in turn — idle, burner up, then a smoothstep climb that SHRINKS her to 0.3 — and STAYS gone until all of them have gone, at which point the whole field fades back together. Her ground shadow is a tagged sibling, `.cc-launch-shade` with `data-pad`, and fades out over the first third of the climb. **The id must wrap the balloon and nothing else** — see the trap below. | Albuquerque |
| **Idling animals** — alive while standing still | `.cc-idle` with `data-i` for a stable phase, containing `.cc-head` and/or `.cc-tail`, each with `data-pivot="x,y"`. The head pivots at the WITHERS, not the poll. Touches only those two parts, never the root, so it composes with anything driving the animal along. | Bluegrass |
| **Barrier** — lifts for road traffic | `.cc-plant-boom` with `data-pivot="x,y"` (the hinge). Raises while a car is heading into the site and drops behind it. Nothing to do with the crossing gate — that one is the game. | Detroit's plant gate |
| **Ropeway** — a lift is a loop, not a line | Two ropes side by side, `#…-path-up` / `#…-path-down`, with cabins `#cc-<lift>-up-N` / `-down-N` carrying `data-t`. Driven in OPPOSITE directions or it reads as a one-way conveyor, and everything shrinks as it climbs — `0.95 − 0.5t`, which is exactly the rule the art was drawn to. | Sun Valley's gondola and chairlift |
| **Ski run** — a line of turns, not a fall line | `.cc-skier` with `data-run`, `data-t`, `data-s`; the run itself is `<path id="run-path-N">` wandering inside its corridor. Scale `0.34 + 0.34t` because the bottom of a run is nearer, and the lean comes from the tangent. | Sun Valley |
| **Race** — a pack that keeps its lanes, and a pit stop | `.cc-racer` ids `cc-racer-<n>` on the straight (the class alone also matches the paddock — select on the number); `<path id="pit-in-path">` / `pit-lane-path` / `pit-out-path`, `#pit-box-stop`, `.cc-racer-wheels` so they can come off, and `#cc-racer-pit` hidden while another car is in the stall. | Indianapolis |
| **Station stop** — the train calls, people get on and off | `.cc-platform` with `data-stop` (the HEAD position — the head is the ENGINE, so aim it so a coach and not the loco ends up at the deck) and `data-dwell`; `.cc-passenger` figures with `data-stand="x,y"`, `data-door="x,y"`, `data-role="board"`/`"alight"`, `data-scale`. Every other train calls. **Not ambient** — it stops the gameplay train — but gate-blind like the shunt. | Cedar Point |
| **Crawl** — a vehicle that follows the ground | `.cc-crawl` with `data-crawl="x,y x,y ..."` in scene coordinates, plus `data-scale`, `data-speed`, `data-nose`. Walks the polyline and takes its PITCH from the segment under it, measured left-to-right because the ground does not care which way you are driving. Read the points straight off the silhouette of whatever it climbs. | Moab's jeep on the block |
| **Canter** — an animal that runs on its own legs | `.cc-canter` with `data-run="from,to,y"`, `data-scale`, `data-speed`, `data-nose`; `.cc-canter-body` inside takes the bob so the shadow stays flat on the ground; each leg is a `.cc-leg` with `data-pivot="x,y"` at the joint it swings from. Stride is measured in DISTANCE, so the legs cannot pedal independently of the speed. | the Bluegrass thoroughbred |
| **Geyser** — waits, erupts, falls back | `.cc-geyser` wrapping everything ABOVE the vent (never the cone) with `data-origin="x,y"` at the mouth. Scales about that point so the column grows out of the vent rather than inflating around its middle. | Yellowstone |
| **Aurora** — curtains breathe and drift | `.cc-aurora` on the parent; every direct child gets its own slow drift and fade, so the sky ripples instead of sliding sideways as one sheet. | Denali |
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
| **Where the road goes next** | `.cc-road-exit` with `data-exit="farEdgeY,nearEdgeY,junctionX"`, plus an optional 4th token `east`. Without it the side road runs two opposed lanes (Rim Drive). With it BOTH streams run east in one lane — off the carriageway and away, and in from the far west then right onto the carriageway — which is the only way a narrow street can carry two directions. `nearEdgeY` must sit ON the tarmac, or the car is deleted at the road's end before it can turn. | Crater Lake, Sun Valley, Indianapolis |
| **Where the road ends** | `class="cc-road"` on the carriageway polygon — the engine reads its far edge | every scene |

Two traps, both already paid for once:

- **Whatever the engine moves, the id must wrap that and ONLY that.** The
  Albuquerque pads originally had the balloon's ground shadow and a crew member
  with a fan inside the same group, because they belong to the pitch. So when a
  balloon launched it carried both into the sky — a shadow and a man hanging in
  mid-air under the basket. Anything belonging to the ground has to be a SIBLING
  of the thing that leaves the ground, not a child of it.
- **The road corridor does not stop where the tarmac does.** `check-scenes.py`
  tests props against the road POLYGON, so nothing flagged the auto-rack parked
  at x=604 across Detroit's plant entrance — the siding sits at y=418, above the
  road's far edge at y=436, and is therefore outside the polygon while being
  squarely in the way. If a road runs out at a gate, keep the line it would have
  taken clear beyond it too.
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
- **ANIMATE ONE OF A GROUP AND THE REST LOOK BROKEN.** Nine still horses in a
  paddock read as a painting; one cantering past eight frozen ones reads as
  eight things that are stuck. This was spotted by a three-year-old about two
  seconds after the cantering one shipped. Either the whole herd moves or none
  of it does — and idling is cheap, so it is nearly always the whole herd.
- **A tail flicks, it does not wag.** A sine wave gives you a metronome, which
  is a dog. Still most of the time, then a brief swish.
- **A car on a side road points where it is GOING, not where it was drawn.** The
  sprite's nose follows `dir` — +1 faces the viewer, -1 faces away — so the
  quarter-turn has to be signed by both. A fixed `rotate(90)` was right for the
  only two cases that existed and sent the third down the street in reverse.
- **`nearEdgeY` threads a 4px gap at Indianapolis.** Below the road's end the car
  is deleted before it can turn; above its own stop line it cannot be held, so it
  drives through a closed crossing. It has to be turnable AND stoppable.
- **Traffic joining a circuit has to change speed.** It leaves the access road at
  about 65px/s where the pack runs 210 and up, so it winds up to racing speed
  going on and sheds it coming off. And it gets a lane of its own: the pack was
  moved off the near lane, which is the one the access road arrives at.
- **Keeping a gap may HOLD a car, never shove it backwards.** If the one in front
  appears closer than the gap — which is exactly what a car turning out of a
  junction does — capping the follower drags it the wrong way up the street.
- **Give way by going round, not by stopping.** Refusing to turn out until the
  junction cleared deadlocked it: the car waiting to turn down cannot move until
  the carriageway clears, and it was blocking the only way off the carriageway.
  A car turning right pulls out AHEAD of stationary traffic instead.
- **A car joining a road has to give way.** Turning onto the carriageway without
  looking put it straight on top of traffic already there.
- **Let the ART decide, not a measurement.** The engine used to work out whether
  two lanes would fit and quietly drop to one where they would not. It was a
  stopgap, and the moment the car's assumed width was corrected from 72 to 89 it
  silently took Rim Drive's inbound traffic away — no error, nothing in the
  console, just a scene quietly doing less than it used to. Scenes say what they
  are; the engine does what it is told.
- **A car's widest point is its WHEELS**, at ±44, not the 72 of its body. That is
  what has to fit on a side road, and what made Ketchum's 24px street too narrow.
- **Two lanes only if two lanes fit.** A car on a side road is turned a quarter,
  so what has to clear is its WIDTH. Rim Drive is a 56px band and clears it;
  Ketchum's cross street is barely 30 and does not, so the two streams drove
  through each other. The engine measures it and runs the street one way where
  they will not fit, rather than shoving a lane onto the verge.
- **A mirrored thing's overhang is not symmetric either.** Sun Valley's plough
  runs -252..+114 about its origin, so mirrored on the outward pass it reaches
  252 to the RIGHT. Bounding its path by the -252 end alone put the blade on the
  carriageway at one end and the whole machine off frame at the other.
- **Anything a vehicle drives ON must be painted BEFORE it.** Indianapolis's
  access apron and grass verge came after the pack, so a car in the nearest lane
  was sliced in half every time it passed the gate.
- **Two things kill a car that has turned off a truncated road.** The fade over
  the last 46px before the road's end, and the removal at `y < roadTop`. Sun
  Valley's cross street is 7px PAST the tarmac, so cars turned onto it at 7%
  opacity and were then deleted on the same frame — the junction worked
  perfectly and nothing was ever seen using it. Both now apply only while a car
  is still on the carriageway. Crater Lake never showed either because its
  junction is 64px clear of the end.
- **A class can be worn by more things than you think.** `.cc-racer` is on
  eighteen cars at Indianapolis, not the six on the straight: ten queue on the
  grass and one sits in the pit box. Animating on the class alone sent the whole
  paddock driving off across the infield. Select on what you actually mean.
- **A platform has to ABUT the track.** Ten pixels of grass showing between the
  deck and the ballast and the passengers read as crossing a lawn rather than
  stepping off a platform onto a train. The track band ends at 516, so that is
  where the deck starts. Feet go on the deck's TOP edge too — in a flat side-on
  view a figure standing at the bottom edge is standing in FRONT of it.
- **Rigid legs need a SMALL swing.** The thoroughbred's knee and hock are drawn
  into the path, so rotating a whole leg at the shoulder is a pendulum, not a
  stride. 24 degrees read as a rocking horse; 13 reads as a horse. And no two
  legs may sit near each other in phase — 0/0.5/0.12/0.62 put the near pair an
  eighth of a stride behind the far pair, which the eye takes as both sides
  moving together. Four beats, properly spread.
- **Anything drawn at a fixed x inside a moving thing gets left behind.** The
  horse's white socks are painted outside the leg groups, so on the runner they
  hung in the air between her legs. She goes without them.
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

## What moves today (25 scenes)

| Scene | What |
|---|---|
| Rocky Mountains | Georgetown Loop train on the trestle · gondola up the peak |
| Chicago | Ferris wheel · the L along the viaduct · airliner over the lake |
| Cape Canaveral | rocket launches off Pad 39 with an exhaust column |
| Gatlinburg | SkyLift chairs up the hillside |
| Horseshoe Curve | 25-wagon freight round the bowl |
| Crater Lake | traffic turns onto Rim Drive |
| Wheat Country | the tractor works both fields, calls at the grain elevator, and turns at the verge — it never crosses the road |
| San Francisco | a ferry crosses the bay and a sailboat tacks across it, each at its own pace |
| Sun Valley | the game's own traffic turns onto the cross street at the junction · gondola and chairlift run both ways · skiers turn down seven runs · two ploughs work the verge and the town street |
| Indianapolis | six cars hold their lanes on the straight · one pits, is jacked up and has its wheels changed · the road traffic is open-wheelers |
| Moab | one jeep crawls up over the block and down its far face · another potters the bench |
| Bluegrass | a thoroughbred canters the paddock · every horse and the foal graze and swish their tails |
| Yellowstone | the geyser waits, erupts and falls back on a 27s cycle |
| Denali | the aurora breathes — each curtain on its own drift and fade |
| Oʻahu | three catamarans work the reef, each at its own pace |
| Duluth | a thousand-footer crosses the lake · a tug works the canal, under the span |
| Quechee | the falls pour over the dam · the boil churns at the base |
| Detroit | plant-gate barrier lifts for the works traffic · **not ambient** — every other train stops and a gantry crane loads an auto-rack onto it. See below. |
| Albuquerque | nineteen balloons drift and bob in parallax · ten burners pulse out of step · the three on the field go up one at a time ~20s apart, then all come back together |
| Mount Washington | the cog train climbs to the summit, waits, and comes back down — engine always below the coach, pushing |
| Cedar Point | three-car trains on both coasters — slow up the lift, fast down the drop · every other train calls at the depot platform, three get on and two get off |
| Seattle | the ferry crosses Elliott Bay and turns at the houseboat moorings |
| New Orleans | the sternwheeler works the Mississippi, paddlewheel turning |
| Austin | the bat column boils out from under the Congress Avenue Bridge |
| Las Vegas | the marquee bulbs chase round every sign on the Strip |

---

## Queued, best first

The original queue is empty — everything on it has been built. What is left is
the below-the-line list, and whatever the next scenes bring.




---

## Detroit is the exception: this one IS the train

Everything else in this file is scenery. The Detroit shunt is not — it is the
gameplay train doing something, and it lives in `updateTrain`, not here. It is
written up in this file only because this is where anyone looking for "what
moves" will come.

    the train runs in and brakes to a stand
    a gantry crane picks a loaded auto-rack off the siding
    carries it across the yard and sets it on the back of the train
    the train pulls away one wagon longer

The crane is the point. Without it the wagon drifted down on its own and, in the
maintainer's words, a ghost was loading the train.

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

**The parked racks ARE the wagon.** The authored siding is a mix of enclosed vans
and open cages, and whichever one gets picked has to become the consist's
auto-rack. The first attempt animated the consist's wagon and simply swapped at
the start of the roll, betting that a change at small scale would not be noticed.
It was, immediately: parked it was a closed brown box, and the instant it moved
it became an open cage full of cars.

So at mount each `#cc-autorack-N` steps aside and a real `wagon-autorack` takes
its place, scaled from bounding boxes to occupy the same length of siding. Same
art parked as rolling, so there is nothing left to hide — measured at the swap
frame, the two are 0.3px and 0.0015 of scale apart, which is one frame of easing.

This has to run with the scene attached to the document: getBBox on a detached
node is all zeros.

**The crane.** `.cc-crane` carries `data-girder` (the underside of the beam) and
contains `.cc-crane-trolley`, which the engine slides along it. The cables and
the spreader are NOT in the artwork — `scene.js` builds them into the train's own
layer, because they have to share depth with the wagon they are carrying; left in
the scenery layer they would be drawn behind the rails while the load hung in
front of them. `buildConsist` empties that layer, so it puts the hoist back.

Three numbers were found the hard way and are worth keeping:

- **The legs stand at x=96 and x=1184.** A gantry has to straddle the siding and
  the main line, and the road, the crossing and both gates all live between
  x=552 and x=728. There is nowhere in the middle to put a leg.
- **The girder is at y=302, and that is set by the load, not by taste.** A parked
  rack's roof is at 363; at a girder of 336 the lifted wagon's roof came out
  *above* the beam with the spreader inside it.
- **The train stops so the crane has a journey.** The first version put the
  coupling slot right beside the rack it was lifting, so the load travelled 26px
  and the crane looked pointless. The slot is placed first, near the left with
  the engine still on screen, and then the rack is chosen for the LENGTH of the
  carry — about 560px.

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
