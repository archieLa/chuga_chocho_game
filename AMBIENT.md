# Ambient motion — the contracts, what moves, and what is queued

Scenes have things in them that move on their own: a train round the Horseshoe, a
rocket off Pad 39, a tractor in the Kansas wheat. None of it is gameplay. **The
crossing is the game**; this is the world going about its business behind it.

**This file is not part of any art drop.** `SCENE_GUIDE.md` and `SCENE_ROADMAP.md`
come from the scene collaborator and get overwritten every time a drop lands, so
the queue below lives here instead, where it survives.

---

## The one rule

> **Ambient means it runs whether or not a train is on screen.** Put an update call
> inside `updateTrain` and it stops the moment the train leaves, because that function
> returns early with none running. It has caught me twice — New York's bus froze halfway
> down the street and the whole of Wisconsin Dells stopped between trains. Ambient
> updates go in the ambient loop next to `updateFlags`; only things the train actually
> does — the shunt, the station stop — belong in `updateTrain`.

Motion is always **gate-blind**. Nothing here reacts to the crossing, waits
for it, or is blocked by it. If a thing needs to know about the gate it is not
ambient motion, it is gameplay, and it belongs somewhere else.

### Four things now read the gate, and here is the whole of it

The rule is still the rule and everything that can be gate-blind is. Four are not,
all in one direction: they **listen, and the crossing never hears back**. The gate's
own behaviour, its two buttons and the physical endpoint are byte for byte what they
were, and no child can tell the difference at the crossing itself.

* **Bentonville's bike signal** goes green a beat after the gate is down. That is not
  a concession, it is the scene: a rider held at a red light *because a train is
  coming*, then released. The same lesson the gate teaches, taught twice, without a
  word.
* **Glacier's tour bus** does not set off while the gate is down, because it would
  drive out of frame just as the child looks up.
* **Lewes's lane signal** is red while the gate is down and green a beat after it lifts. This one is barely a  concession: the gate is physically what is holding those cars, so the signal reports the road's own state  rather than borrowing the crossing's. Two waiting-and-goings in one frame, and nobody has to explain the  connection.
* **Bailey Yard's shuffle** puts its wagon down and gets out of the way, because the
  same crane is about to load the train.

If a fifth wants in, it needs a reason of that size.

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
| **The road ends inside a ship** | `data-cars="ferry"` on the road polygon — it extends the ENGINE'S OWN traffic rather than adding scene elements, the same way `data-cars="race"` does. `carEndY()` gains 14px so a car's run does not stop at the tarmac, and over the last stretch the car steers to the middle of the opening and shrinks while the existing fade swallows it. **Do not clip it to the mouth** — the road is painted after the ship, so a clip that hides the car inside also hides it on the road. Shrink and fade is cheaper and closer to what a dark hold looks like. | Lewes |
| **A berth** — lane signal, ramp and queue as ONE sequence | `.cc-ramp-lift` (rotate about its hinge, about -14 degrees and no more: a ferry ramp barely moves and the drama is the road KEEPING GOING onto a ship). **The ramp follows the SHIP, not the crossing** — driven by the gate it lifted every time a train came, which reads as the ferry closing up because a train is passing, and a train has nothing to do with a ferry's ramp, `#cc-lane-signal` with `.cc-lamp-red`/`.cc-lamp-green`, `.cc-queuecar` figures that shuffle a few px up their lane on green and drift back on red, and `.cc-ferry` herself, which sails once every couple of minutes and BACKS IN on the way home — a stern-loading ro-ro reverses into its berth so the ramp faces the shore, so astern is the manoeuvre and not a compromise. Cast off and lift the ramp BEFORE she moves: the mooring lines are not part of `#cc-ferry` and would stretch across open water, and a ship leaving with the ramp in her mouth is a crash. While she is away the lane stays red and `data-cars="ferry"` switches itself off, or cars drive off the ramp into the bay. Needs TWO clocks — one for the beat before green, one for how long the road has been shut — because sharing one lets the red branch reset it every frame and the ramp never lifts at all. | Lewes |
| **A waving arm** | `.cc-wave` with `data-pivot="x,y"` at the SHOULDER and `data-i` for its place in the group. Rotates the arm and nothing else. Arms inside a `.cc-tour` are SKIPPED — the tour bus already drives its own, and two things writing one transform is how you get an arm that jitters. | Dubuque's overlook · (Glacier's bus arms use the same class, driven by the tour) |
| **A lock** — the first mechanism about WAITING | `.cc-lock-water` (one rect: set `y`, height follows), `.cc-lockboat` (rides at the SAME y — its origin is its own waterline, so there is no draft to model), `.cc-gate-l`/`.cc-gate-r` (`scale(sx,1)` about each hinge, eased 1 -> 0.12: a mitre leaf swings back into its recess by foreshortening), `.cc-paddle` driven by DISTANCE RUN so it never turns while the boat sits. The wall does the real work and needs no code: pale concrete above the upper-pool line and painted stain below it, so the rect uncovers a hard dark edge sweeping down a large pale surface. **Do not cut the two still beats** — a child should get that the boat is being MADE to wait. Free-running, so its clock and the gate's drift against each other, which is more interesting than syncing them. | Dubuque |
| **Jets** — water thrown UP | `.cc-jet` with `data-pivot="x,y"` at the NOZZLE and `data-i` for its place in the group. Scales in HEIGHT ONLY about the pivot, so the plume grows out of the pipe rather than inflating around its middle — the geyser's rule. One group per jet: three breathing in step are one jet. | Kansas City's fountain |
| **Watchers** — people who notice the train | `.cc-watch` on the figure, containing `.cc-point` arms with `data-pivot="x,y"` at the SHOULDER and `data-side="-1|1"`. Only the arm on the train's side goes up, so nobody points across their own chest. Follows the child's train when one is running and the ambient one otherwise, and the arms come DOWN when it is too far off — which is what makes the raising read as a reaction rather than a pose. Turning the figure instead is no use: these are drawn front-on and symmetric, so a mirror changes nothing. | Horseshoe Curve's overlook |
| **Slide** — a rider down a flume, and the splash at the bottom | `.cc-slider` on `#slide-path`, each a bare translate with the pose on an INNER group so rotation never fights position; `.cc-splash` at the foot. The speed is written as a VELOCITY CURVE over the path, not an easing of position: slow off the platform, flat out down the drop, running out of steam along the flat. At constant speed a rider is a sticker dragged along a line. The splash is PUNCHED on arrival — 120ms up, 500ms back — triggered by the rider reaching the end, never by a clock. **Scale it with a plain `translate(x,y) scale(k)`** — the group's geometry is authored around its own origin, so the scale-about-an-arbitrary-point sandwich (which belongs to groups drawn in absolute coordinates) throws it clean off the frame. It did, to x=-315, which is why there appeared to be no splash at all. | Wisconsin Dells |
| **Floating on a painted waterline** | `data-water="x0,y0,x1,y1"` and `data-ride` on the vessel. Where the near half of the water is painted OVER a boat, the boat must take its x from the path and its y from the SURFACE — following the path literally sent the duck to y=722 where the surface is at 617, a hundred pixels under, and it crossed the river like a submarine and surfaced the far side. Ease from the path's y to the surface across the waterline and it reads as the hull settling as it takes the water. | the Wisconsin Dells duck boat |
| **Heading, for something drawn in profile** | Ease `scale(sx,1)` from `+1` through `0` to `-1` on a group whose origin is the object's own centre. Through zero the hull foreshortens to nothing and comes back the other way, which is what a boat swinging beam-on to the camera looks like. EASE it — linear through zero is a card flip — and never let sx reach exactly 0, which collapses the bounding box and can stop it rendering. | the Wisconsin Dells duck boat |
| **Coupled linkage** — a machine whose parts must agree | `.cc-pumpjack` containing `.cc-pj-crank` (turns continuously), `.cc-pj-beam` (rocks) and `.cc-pj-pitman` NESTED inside the beam. EVERY PIVOT IS ITS OWN GROUP'S ORIGIN, so animating is only ever rewriting the `rotate()` — read each authored `translate` once and put it back every frame. `beam = A·sin(theta)`, `pitman = -0.55·beam`: an approximation, not a solved four-bar, because the exact answer moves the crank pin two pixels and costs a square root per machine per frame. SLOW and out of step — three nodding together read as one machine copied three times. **The sign on the beam is not arbitrary.** The counterweight is drawn opposite the crank pin, so it is highest at 90 degrees; drive the beam with +A·sin and the horsehead rises with it, which a real one must never do. The weight exists to FALL while the head lifts the rod string, so it is high when the head is DOWN. Check it by measuring the two parts' screen y over time, not by reading the angles — the angle signs are easy to talk yourself into. | Oklahoma City's three wells |
| **Dust devil** — wanders and collapses | `.cc-dustdevil` with `data-foot="x,y"` on `#dust-path`. The foot has to be DECLARED: the group has no transform and its geometry is in absolute scene coordinates, so a bare translate adds to coordinates that already place it and the column sails off the frame. Drifts in ~34s, sways ±2.6° about the foot, takes the depth scale, and fades up and away at the ends rather than walking on from off stage. | Oklahoma City |
| **Transfer** — off one thing and onto another | `data-bus="x,y"` on an ALIGHTING `.cc-passenger`: after the usual walk out onto the platform it waits a beat and walks on to that door, fading as it steps aboard. The far end is `.cc-bus-stop` with `data-bay` `data-away` `data-speed` `data-lead` `data-gone` — it pulls out once everybody who was changing is aboard, and it runs on its OWN clock from there because the train leaves at about the same moment and `train.halt` goes with it. Two separate legs, not one long diagonal: a straight line from coach door to bus door cuts the platform edge. | New York's M14 |
| **Flags** — cloth in a gust | `.cc-flag` with `data-pivot="x,y"` at the halyard and `data-i` for its place in the line. It swings AND furls — rotation alone is a pendulum, the narrowing is what makes it cloth — and phases run along the row so a gust travels down it. | Mount Rushmore's avenue |
| **Idling animals** — alive while standing still | `.cc-idle` with `data-i` for a stable phase, containing `.cc-head` and/or `.cc-tail`, each with `data-pivot="x,y"`. The head pivots at the WITHERS, not the poll. Touches only those two parts, never the root, so it composes with anything driving the animal along. | Bluegrass |
| **Movable structure** — a span that lifts head-on | `.cc-bascule-leaf` containing `.cc-bascule-quad` polygons and a `.cc-bascule-dashes` group. Each piece carries its raised position in `data-up`, point-matched to `points`, and the engine TWEENS THE POINTS — head-on a lifting deck changes width as the foreshortening unwinds and no transform expresses that. Anything without a `data-up` is on the fixed span and stays put. `.cc-bascule-weight` takes `data-dy`. Runs on its own timer. | Mystic |
| **Channel** — boats that wait for a bridge | `.cc-sail` / `.cc-launch` on `#channel-path`. They queue short of the towers and go through together while the span is up. | Mystic |
| **Barrier** — lifts for road traffic | `.cc-plant-boom` with `data-pivot="x,y"` (the hinge). Raises while a car is heading into the site and drops behind it. Nothing to do with the crossing gate — that one is the game. | Detroit's plant gate |
| **Vessel** — drifts along a drawn line of water | `.cc-vessel` with `data-path="harbour"` (the engine finds `[id*="harbour-path"]`), `data-speed` (NEGATIVE runs the path backwards), `data-t`, `data-nose`, `data-bob`. The path carries the y, so a channel that recedes takes its vessels with it. Scale is the art's own and is NOT depth-corrected. | Charleston's sloops and pilot launch, Glacier's kayaks |
| **Tour** — parks, drives off, comes back | `.cc-tour` with `data-bay` (the LEFT EDGE of the parking space), `data-len`, `data-away`, `data-speed`, `data-dwell`, `data-gone`, plus `.cc-wave` arms with `data-pivot` at the shoulder. Never travels backwards: it turns out of sight at the far end and swings round in its own bay. | Glacier's red bus |
| **Counterbalanced pair** | `.cc-funi` cars on `#funi-path-a` / `#funi-path-b`, sampled from ONE t — one forward, one reversed. As one goes up the other must come down at the same rate; give them a t each and they drift, and it is immediately obvious. | Dubuque's Fenelon Place Elevator |
| **Ropeway** — a lift is a loop, not a line | Two ropes side by side, `#…-path-up` / `#…-path-down`, with cabins `#cc-<lift>-up-N` / `-down-N` carrying `data-t`. Driven in OPPOSITE directions or it reads as a one-way conveyor, and everything shrinks as it climbs — `0.95 − 0.5t`, which is exactly the rule the art was drawn to. | Sun Valley's gondola and chairlift |
| **Ski run** — a line of turns, not a fall line | `.cc-skier` with `data-run`, `data-t`, `data-s`; the run itself is `<path id="run-path-N">` wandering inside its corridor. Scale `0.34 + 0.34t` because the bottom of a run is nearer, and the lean comes from the tangent. | Sun Valley |
| **Race** — a pack that keeps its lanes, and a pit stop | `.cc-racer` ids `cc-racer-<n>` on the straight (the class alone also matches the paddock — select on the number); `<path id="pit-in-path">` / `pit-lane-path` / `pit-out-path`, `#pit-box-stop`, `.cc-racer-wheels` so they can come off, and `#cc-racer-pit` hidden while another car is in the stall. | Indianapolis |
| **Station stop** — the train calls, people get on and off | `.cc-platform` with `data-stop` (the HEAD position — the head is the ENGINE, so aim it so a coach and not the loco ends up at the deck) and `data-dwell`; `.cc-passenger` figures with `data-stand="x,y"`, `data-door="x,y"`, `data-role="board"`/`"alight"`, `data-scale`. Every other train calls. WHERE it can go is usually decided by the two gate BUTTONS, which cover x 409-589 and 691-871 from y 518 down — and it has to be the near side, because on a far platform the stopped train stands exactly where the waiting passengers are. **Not ambient** — it stops the gameplay train — but gate-blind like the shunt. | Cedar Point, Newport, Boston, New York, Horseshoe Curve |
| **Crawl** — a vehicle that follows the ground | `.cc-crawl` with `data-crawl="x,y x,y ..."` in scene coordinates, plus `data-scale`, `data-speed`, `data-nose`. Walks the polyline and takes its PITCH from the segment under it, measured left-to-right because the ground does not care which way you are driving. Read the points straight off the silhouette of whatever it climbs. | Moab's jeep on the block |
| **On the carriageway, behind the rails** | `data-over-road="1"` on the mover. Scenery lives in scenery-back, which is painted UNDER the road, so anything authored there that crosses the road goes beneath the tarmac. The engine lifts it into a group of its own placed AFTER `#gate-far` — not merely after `#road`, which was the obvious slot and is wrong: the far gate's arm comes down across y=421 and a bike path at 426 vanishes under it at exactly the moment the gate lets the riders cross. Its own group and never `cc-cars-far`, which is emptied when you leave a scene. | Los Angeles's cyclists |
| **Give way to traffic** | `.cc-cyclist` with `data-run` `data-y` `data-scale` `data-speed`. The engine already knows where the carriageway is at any y, so the art never declares it. The gap is asked for in SECONDS — how long THIS rider needs to be across against how long each car needs to arrive — because a fixed look-ahead is wrong for a fast rider and wrong again for a slow car. **A stationary car is not traffic**: whatever is holding it, it is not going to arrive, and counting a queue as traffic sealed the riders in exactly when the road was safest. Once a rider sets off it finishes; changing its mind in the middle of the road is worse than never leaving the kerb. | Los Angeles |
| **Canter** — an animal that runs on its own legs | `.cc-canter` with `data-run="from,to,y"`, `data-scale`, `data-speed`, `data-nose`; `.cc-canter-body` inside takes the bob so the shadow stays flat on the ground; each leg is a `.cc-leg` with `data-pivot="x,y"` at the joint it swings from. Stride is measured in DISTANCE, so the legs cannot pedal independently of the speed. | the Bluegrass thoroughbred |
| **Ride** — a rider that follows a CHAIN of drawn paths | `.cc-ride` on the mover itself, with `data-legs` = ordered path ids (`id@x0:x1` rides part of one), `data-speed`, `data-t`, `data-nose`, `data-hide` (a second drawing of the same person, hidden at mount), `data-hold="leg@x"` (wait there until the bike signal releases you) and `data-shadow-leg="leg@x0:x1"` (where `.cc-ride-shadow` tracks the rider in x). `data-bob` gives a vertical bob keyed to DISTANCE, so a mover held at a signal stands still instead of bouncing — at twenty pixels tall that is what says walking, and articulated legs would say nothing. Rotates to the path tangent, so nose-up off a ramp and nose-down onto a landing are free. | Bentonville's berm-to-jump loop, its Greenway riders, its trail riders · Birmingham's tour party |
| **A route that ends somewhere real** | `data-turn="<secs>"` — pause at each end and walk BACK. A ride without it LOOPS, which is right only when both ends are off frame. Birmingham's tour route is exported the full width of the site and the middle of it is a live carriageway, so the party works a stretch that stops short of the kerb and turns round. The first fix was to draw them ON the road rather than under it, which answered the wrong question — they should not be walking into traffic at all. | Birmingham's tour party |
| **Never let a path double back** | The engine mirrors rather than rotating past vertical, so nothing can end up upside down — but a rider that arrives at a stop line travelling backwards still has to turn round in front of the child before it can leave. Bentonville's berm exit swung right and returned, and the rider sat at the red light inverted. Draw the exit going the way the next leg goes. | Bentonville |
| **Bike signal** — a second crossing, slaved to the first | `.cc-bike-signal` containing `.cc-lamp-red` and `.cc-lamp-green`; the engine swaps their `fill`. Goes green a beat after the RAILWAY gate is down. **The one thing back here that is not gate-blind** — see the note under the rule. | Bentonville |
| **Vultures** — birds on a thermal | `.cc-vulture` with `data-ring` (the id of an `<ellipse>`), `data-t` and `data-tilt`. Orbits the ellipse, SCALES with its place on it — bigger at the near side — and rocks a few degrees. Two rings, because one ring of birds all one size reads as a clock face. | Bentonville |
| **A group that moves together** | Nothing. Give every animal the SAME range LENGTH and the SAME `data-speed`, with the ranges offset by the spacing you want. They set off together, turn together and come back together for ever, because they each cover the same distance between the same pauses. Any group logic here would be code earning nothing. | the Bluegrass family |
| **Geyser** — waits, erupts, falls back | `.cc-geyser` wrapping everything ABOVE the vent (never the cone) with `data-origin="x,y"` at the mouth. Scales about that point so the column grows out of the vent rather than inflating around its middle. | Yellowstone |
| **Aurora** — curtains breathe and drift | `.cc-aurora` on the parent; every direct child gets its own slow drift and fade, so the sky ripples instead of sliding sideways as one sheet. | Denali |
| **Falling water** — a sheet that never stops | `.cc-fall` with `data-band` (the tile height) and `data-secs`. The art draws a band of streaks that TILES vertically and emits it twice, the second copy one band above the first; the engine slides the pair down by exactly one band and it loops with no seam. Clip it to the BROKEN part of the sheet, not the whole face — streaks scrolling over the glassy lip stop it reading as an edge. `.cc-foam` groups churn out of step at the base. | Quechee |
| **Drift** — follow a path and wrap | `.cc-drift` with `data-path` (matched on the END of the id, since ids are namespaced), `data-t` (start position AND phase, so it is stable across runs), `data-speed` (px/s; NEGATIVE runs it backwards), `data-scale`, `data-nose`, optional `data-bob="amp,secs"` and `data-turn` to follow the path's heading. Unlike a shuttle it wraps instead of turning, and it takes a real `<path>`, so a deck with a bend in it needs no special case. | Vicksburg's tow, driftwood and bridge freight · Newport's sails and Pell Bridge traffic · the New River Gorge's rafts and arch traffic |
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
- **An exported hook is not always usable.** Mount Rushmore exports
  `#keystone-street` "for town traffic if wanted" — but there is no roadway drawn
  under it, so cars would drive across grass and shopfronts, and the carriageway
  crosses it, so they would slide behind the tarmac as well. Check there is
  something to drive ON before taking a hook at its word.
- **A flag swings AND furls.** Rotation on its own is a pendulum. The free edge
  collapsing toward the pole between gusts is what reads as cloth.
- **NOBODY WAITS ON THE CROSSING.** A driver does not stop on a level crossing,
  and this game least of all should draw a car parked on the rails. Where a queue
  position would land in the track band, the car waits on the near side instead.
  That one rule is what makes Mystic's queue look real: one at the boom, one in
  the gap before the rails, the rest behind the crossing.
- **A shut bridge stops traffic BOTH ways, and the second way is easy to miss.**
  Northbound queues at it — obvious. But nothing may ARRIVE from the far side
  either, because nothing could have got over. Spawning has to know.
- **Where a road carries on over something, cars must carry on too.** They were
  vanishing on the near abutment because the tarmac polygon ends at the hinge.
  The run extends past it when the way is clear.
- **Two barriers in one scene must not share a driver.** Detroit's `.cc-plant-boom`
  lifts FOR cars; Mystic's drops to STOP them. Same class, opposite job — so
  whoever owns it drives it, and the traffic-watching controller stands down when
  a bascule is present.
- **Release by PHASE, not by how open something looks.** Gating the boats on the
  span's openness let them keep feeding into the gap all through the descent, so
  the bridge waited for a channel that never cleared. Two holds, both one-way and
  neither ever making the child wait: the lift will not begin while the crossing
  gate is down, and will not lower while a boat is between the towers.
- **A far-side platform hides the people on it.** Cedar Point's is on the near
  side, so passengers walk in front of the coaches. Newport's is on the far side,
  and figures standing at the platform EDGE ended up ten pixels above a coach
  roof — four people apparently standing on the wagon tops. They wait at the BACK
  of the platform instead and step forward, vanishing behind the coach as they
  board, which is what boarding looks like from that side.
- **Check which way a thing FACES from its eye, not from a guess.** I read the
  elk's neck path as starting at +26 and assumed it looked right; its eye is at
  x=-41. It walked backwards. The eye, or the nose, is the one part that cannot
  be ambiguous.
- **Pair the parts of a leg before you swing it.** An elk's leg is an upper and
  a lower rect; grouped separately, the dark hoof stays behind while the leg
  swings away from it.
- **A stride is the length of the ANIMAL.** The canter contract had one stride
  for everything that walks; a hiker with 13-unit legs given a horse's 78-unit
  barrel moonwalks. `data-stride` per animal.
- **A swing is an ANGLE, so what you see is angle x distance-from-pivot x scale.**
  2.6 degrees on a horse's head moved a distant muzzle less than a pixel and was
  reported as "barely noticeable". Eight degrees on the same horse is ~3px, and
  ~8px on the foreground mare. Work out the pixels before picking the number.
- **Standing still reads as broken even when something twitches.** Head-up
  animals were the ones that still looked stuck after they gained an idle — a
  grazing animal at least looks busy. Give them somewhere to walk.
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
- **READ the transform a thing is already drawn with; never assume translate(0,0).**
  Bailey Yard's wagons are authored at `translate(centre - halfLength, railY)` —
  their origin is their own left end, not the scene's. Writing a bare offset over
  that teleported all four to the top-left corner, where the crane went on
  picking up nothing with perfect mechanical accuracy.
- **To CARRY something, put it in the carrier.** Bailey Yard's crane drives the
  wagon's own transform perfectly well — the crab's x and the hoist's y are known
  every frame — and it looked wrong, because the loading track is painted before
  the diesel shop and the gantry after it, so a lifted wagon slid up BEHIND the
  building while the crane holding it stayed in front. Reparenting into the
  hook fixes the depth and the maths at once: inside it the offset is constant.
- **Put it back where it was, not on the end.** `appendChild` returns a borrowed
  wagon to its layer at the BACK of the document order, so after one shuffle it
  drew in front of the fence and the men standing at the track. Remember
  `nextSibling` as well as the parent and `insertBefore` it.
- **A spreader locks ON the load; nothing hangs below it.** I read Bailey's
  `data-home-y` (the hook's RESTING height, tucked up) as a gap to hang a load
  at, and put 34px of daylight between the beam and the wagon's roof. The
  maintainer's word for it was "some invisible force between wagons and crane
  arm", which is exactly what it is when nothing is touching. What keeps the beam
  readable under a load is being WIDER than it, not being above it.
- **Size a thing by DEPTH, not by taste.** Bailey's loading-track wagons were
  drawn at 14.5m — half again longer than the same wagon looks when the child's
  own train pulls in on the main line, which is NEARER. The engine now sizes what
  it substitutes there by `depthScale(y)`, exactly as it sizes the train, so the
  two cannot disagree. "These are the nearest wagons so they should be the
  biggest" was written about wagons that are not the nearest.
- **People come off the ruler, always.** They were sized against those oversized
  wagons instead — sound reasoning, wrong yardstick, and the men came out over
  two metres tall. `ppm(y) * 1.75 / <figure height>` and nothing else.
- **A door has WIDTH.** The shop's doors stepped their LEFT edge from one margin
  to the other, so the last of each row hung 32px past the end of the building —
  a shutter and its lintel floating in the air over the yard behind.
- **Gather every reason a car cannot move into ONE limit, then apply it once.**
  Clamping the position in stages and then second-guessing the result is how the
  Mystic queue came to oscillate: the keep-clear rule fired only on the frame a
  car was actually pinned, shoved it back off the rails, and then let it creep
  forward until it was pinned again — a ~30px limit cycle for every car behind
  the second. Snap the LIMIT out of the danger and the car simply rests.
- **Nobody waits on the crossing.** A driver does not stop on a level crossing,
  and this game least of all should draw one parked on the rails. A hold that
  would land a car in the track band moves to the near side of it instead.
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
| Vicksburg | a tow pushes fifteen barges upstream · driftwood comes down past it · a freight crosses the railroad bridge |
| Newport | four sails drift the bay at their own speeds · traffic crosses the Pell Bridge both ways  · the train calls at the station and people get on and off |
| Mystic | the bascule span stands on end and a queue of boats goes through · a boom shuts the road first · quay traffic |
| New River Gorge | three rafts run the rapids, bobbing · traffic crosses the arch 876 feet up |
| Mount Rushmore | the avenue of banners stirs, a gust running down the line |
| Grand Canyon | three hikers walk the rim trail · a mule deer ambles the bench, lifting its head |
| Cape Canaveral | rocket launches off Pad 39 with an exhaust column |
| Gatlinburg | SkyLift chairs up the hillside |
| Horseshoe Curve | 25-wagon freight round the bowl · eight people at the overlook point at whichever train is passing, the child's or the one going round the bowl |
| Crater Lake | traffic turns onto Rim Drive |
| Wheat Country | the tractor works both fields, calls at the grain elevator, and turns at the verge — it never crosses the road |
| San Francisco | a ferry crosses the bay and a sailboat tacks across it, each at its own pace |
| Sun Valley | the game's own traffic turns onto the cross street at the junction · gondola and chairlift run both ways · skiers turn down seven runs · two ploughs work the verge and the town street |
| Indianapolis | six cars hold their lanes on the straight · one pits, is jacked up and has its wheels changed · the road traffic is open-wheelers |
| Moab | **all three jeeps drive** — one wanders the far bench, one crawls up over the block and down its face taking its pitch from the rock, and the near one works the trail below, west of the carriageway |
| Bluegrass | **every horse in the county walks** — twelve of them, none left standing, two mother-and-foal pairs holding formation on offset ranges and nobody crossing the drive |
| Yellowstone | the geyser erupts · five bison amble the sage flat and two bull elk cross it |
| Denali | the aurora breathes — each curtain on its own drift and fade |
| Oʻahu | three catamarans work the reef, each at its own pace |
| Duluth | a thousand-footer crosses the lake · a tug works the canal, under the span |
| Quechee | the falls pour over the dam · the boil churns at the base |
| Dubuque | three children wave from the overlook, out of step with each other · the lock fills, its gates swing open and the sternwheeler leaves, on a 45-second clock of its own · the swing bridge turns once every couple of minutes, because one that is always swinging is a fairground ride · the funicular's two cars counterbalance |
| Lewes | cars released by the gate drive up the ramp and into the ship · the lane signal turns green a beat after the crossing lifts and the queue shuffles forward · the ramp lifts through the long red · **she casts off and sails once every couple of minutes, and backs in astern on the way home** |
| Detroit | plant-gate barrier lifts for the works traffic · **not ambient** — every other train stops and a gantry crane loads an auto-rack onto it. See below. |
| Bailey Yard | the portal crane shuffles wagons about the loading track · **not ambient** — every other train stops and the same crane lifts a wagon onto it. See below. |
| Albuquerque | nineteen balloons drift and bob in parallax · ten burners pulse out of step · the three on the field go up one at a time ~20s apart, then all come back together |
| Mount Washington | the cog train climbs to the summit, waits, and comes back down — engine always below the coach, pushing |
| Cedar Point | three-car trains on both coasters — slow up the lift, fast down the drop · every other train calls at the depot platform, three get on and two get off |
| Seattle | the ferry crosses Elliott Bay and turns at the houseboat moorings |
| New Orleans | the sternwheeler works the Mississippi, paddlewheel turning |
| Austin | the bat column boils out from under the Congress Avenue Bridge |
| Los Angeles | three yachts work the bay at their own speeds · a kite swings on its line, tail and all, and the string is redrawn to follow it · **three cyclists ride the Braude path and give way at the kerb** — the first thing in the game that waits for the CARS rather than the gate |
| Las Vegas | the marquee bulbs chase round every sign on the Strip |
| Horseshoe Curve | every other train calls at the observation halt — five people get on and off, while the ambient train keeps going round the bowl above them |
| New York | every other train calls at the platform above the M14 stop — five people get on and off, two of them carry on down to the bus, and the bus pulls away with them · the city finally has people in it at all |
| Boston | fifteen boats work the Charles, each on its own stretch at its own speed — the fleet stays spread the way the art placed it instead of bunching at one end · every other Green Line car calls at the Esplanade stop, and the man walking his dog comes up off the lawn to join them, the dog a beat behind |
| Wisconsin Dells | a child rides the near flume into a splash and climbs back for another go · a second rider inside the enclosed tube on the tower · the duck boat drives down the ramp, noses into the river, turns round and heads off upstream |
| Oklahoma City | three pumpjacks nod, each at its own rate and its own phase · a dust devil wanders the field and collapses at the far end |
| Kansas City | the fountain runs — three jets pulsing out of step, sheets over both basin lips, the pool shifting · the flag swings and furls on its pole |
| Birmingham | a tour party of four walks the site together, in step, turning back at the kerb and at the frame edge · everyone else stands, because a place where everybody moves looks evacuated · the furnace is COLD and stays cold — no pour, no glow |
| Bentonville | **one rider does the whole circuit** — timber wave, down to the Greenway, held at the red light, across the road when the gate drops, up the ramp and over the gap with its shadow on the dirt · two more riders queue at the same light · two riders come down out of the woods · six vultures on two thermals |

---

## Vessels (.cc-vessel) — one contract, two scenes

Charleston's sloops and pilot launch and Glacier's kayaks turned out to be the
same idea twice: a small craft on a drawn line of water, going one way, wrapping
round off-frame and coming back. So they are ONE contract, and the next harbour
or river gets it for nothing.

```
class="cc-vessel"  data-path="harbour"   the engine finds [id*="harbour-path"]
                   data-speed="-15"      px/sec; NEGATIVE runs the path backwards
                   data-t="0.40"         where it starts, 0..1
                   data-nose="1|-1"      -1 if the art is drawn facing the other way
                   data-bob="1.1"        optional swell, in px
```

The path carries the y, so a channel that recedes takes its vessels with it and
the art never has to say so twice. **Scale is the art's own and is NOT
depth-corrected** — Glacier's kayaks are drawn at roughly twice true scale on
purpose, because a true-scale kayak at that distance is a smudge, and
"correcting" it would delete them.

Mixed directions and four different paces, deliberately. A harbour where
everything runs one way at one speed is a conveyor belt.

Charleston's container ship stays **berthed**, as the art intended: it is
alongside under the cranes, being worked, which is the reason the cranes are
there at all. Sail it away and they are lifting nothing.

## The tour bus (.cc-tour) — why it turns round twice

Glacier's red bus is parked at a viewpoint with five people standing up through
the open roof, three of them waving. Every so often it takes a run up the valley
and comes back, and everyone keeps waving the whole way.

**It never travels backwards, and that costs a turn.** The bus is drawn in
`scenery-back`, which is painted UNDER the carriageway, so it stays on the inn's
side of the road — one exit, to the left. With one exit the arithmetic is forced:
bay → off-frame → bay is two traversals, and a single flip out of sight leaves it
facing the wrong way to set off again. So it turns twice: once at the top of the
valley where nobody can see it, and once in its own bay, which is what a bus in a
car park actually does. The bay turn is a swing through `scaleX = 0` about the
middle of the parking space, so it comes round on the spot and stays in its bay.

The one line that makes all of that tractable: **x is the body's LEFT EDGE, never
the transform's origin.** A mirrored group hangs to the left of its origin, so
`origin = x + len * (1 - f) / 2` covers driving, parking and the swing at once.

Driving it right across the frame was built and then taken out. It needed lifting
out of scenery-back into the road's own depth, and a bus sailing past the
crossing while the cars beside it wait at the gate is the wrong thing to show in
a game whose entire subject is the gate. The maintainer called it before it
shipped.

## Bailey Yard loads the train too — and shares one crane to do it

Agreed with the maintainer and his tester, overruling an earlier call of mine. I
had the yard crane shuffle wagons around the loading track rather than load the
train, reasoning that Detroit already did the latter and two scenes doing the
same thing was a waste. They disagreed, and they were right: the coupling moment
is the best thing in Detroit, and "don't repeat yourself" is a rule about code,
not about fun.

Bailey's gantry now **speaks Detroit's crane contract instead of forking it**.
`planShunt` / `updateShunt` / `buildRacks` are shared; what was scene-specific
got widened rather than duplicated:

- **`buildRacks` reads two dialects.** Detroit's `#cc-autorack-N` places from its
  own transform; Bailey's `#cc-crane-wagon-N` is authored at the wagon's LEFT end
  and labels the middle it wants, and says its `data-kind`, so a yard can hold a
  mix of `wagon-container` and `wagon-boxcar`.
- **The wagon that joins the train comes from the scene, not from a constant.**
  Because the crane's pick is chosen after the consist is laid out, `launchTrain`
  builds with the first kind, plans, and if the plan wanted a different wagon
  builds that one and re-plans around it — `planShunt(pin)` keeps the same rack
  so the second pass only moves the stopping place.
- **Each scene's own hardware does the hoisting.** Detroit's `.cc-crane` has no
  ropes in the artwork so `setCrane` draws them; Bailey's are real, and drawing
  Detroit's over the top would have hung a second spreader on a good one.
- **The hook height comes from the load, not from the number 140.** Each rack
  measures its own roof at build time, which is what makes one crane serve an
  auto-rack, a double-stack and a boxcar.

**One crane, two jobs, and the shunt wins.** Between trains it still shuffles
wagons about the loading track. The first attempt let the shunt run only when the
crane happened to be free — and a shuffle takes the best part of fifteen seconds,
so the crane is almost never free and the shunt simply never happened: every
train ran straight through. Now the shuffle YIELDS. It starts nothing new while a
train is due, and if it is already holding a wagon it sets it down at the nearest
free slot rather than carrying it across — a change of mind, not a teleport.

That means the yard crane reads the crossing gate, the one thing back here that
otherwise never does. It is the only warning that a train is coming, and the
traffic is one-way: the crane listens, the gate never hears back, and the game is
exactly as it was.

## Queued, best first

The original queue is empty — everything on it has been built. What is left is
the below-the-line list, and whatever the next scenes bring.




---

## The shunt is the exception: this one IS the train

Everything else in this file is scenery. The shunt is not — it is the gameplay
train doing something, and it lives in `updateTrain`, not here. It is written up
in this file only because this is where anyone looking for "what moves" will
come. **Two scenes run it now, Detroit and Bailey Yard**; the section above says
what widening it took.

    the train runs in and brakes to a stand
    a gantry crane picks a loaded auto-rack off the siding
    carries it across the yard and sets it on the back of the train
    the train pulls away one wagon longer

The crane is the point. Without it the wagon drifted down on its own and, in the
maintainer's words, a ghost was loading the train.

A scene opts in by having `#cc-autorack-N` or `#cc-crane-wagon-N` groups standing
on a siding; every other place still runs a train straight through. Every OTHER
train shunts — always would make the place feel like a cutscene, never would
leave a child waiting on a coin flip for the best thing in the scene.

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

Below the line, in rough order: traffic on the Brooklyn Bridge, a boat in San
Francisco Bay.

**There is no cap on how many scenes move.** There used to be a
twelve-to-fourteen limit in this file, on the theory that too much motion would
pull attention off the crossing. In practice the animations turned out to be
half of why the places are worth visiting, so the call is the maintainer's and
is made scene by scene. Some places are still better still — though not, as it
turns out, the Grand Canyon: hikers on the rim trail and a mule deer moving
across it take nothing away from the canyon, because the canyon itself is what
stays still. The rule is that the LANDSCAPE holds; what lives on it need not.
The earlier version of this paragraph said the Grand Canyon
is about not moving — but that is a judgement about *that* place, not a budget.
