# Handoff — Wave 7

**Rolling doc.** It always describes what's new *since the last integration*. This one
assumes **Wave 6** (Sun Valley, Indianapolis) is already in. If it isn't, integrate that one
first — this sits on top of it.

Four new locations — double the usual wave. No shared furniture changed: `road()`, `track()`
and both gates are exactly what Wave 3 shipped, and nothing already in the game is touched.

This takes Chuga Chocho to **41 destinations across 36 states plus DC**.

---

## What's new

| Scene id | State | Destination | Engine preset |
|---|---|---|---|
| `new-river-gorge` | West Virginia | The canyon floor at Fayette Station, the arch overhead | `diesel` |
| `mount-rushmore` | South Dakota | The carving above Keystone, and the 1880 Train | `steam` |
| `vicksburg` | Mississippi | A tow on the river, the bluff, the floodwall gate | `diesel` |
| `newport` | Rhode Island | The harbour under sail and the Pell Bridge | `steam` |

All four states had **zero** locations, which is what the ordering rule requires.

Four firsts: the first **gorge**, and the first landmark drawn from *underneath* and sitting
entirely above the horizon; the first **Mississippi** and the first **river freight**; the
first **carved monument**; and the first **sail**.

---

## Files in this drop

```
tools/gen-scenes.py            adds new_river_gorge(), mount_rushmore(), vicksburg(), newport()
tools/build-scene-gallery.py   catalogue + gradient-id namespacing for the four new scenes
tools/gen-map.js               SUPPORTED gains West Virginia, South Dakota, Mississippi, Rhode Island

play/js/world.js               four new LOCATIONS entries
play/js/map-data.js            regenerated — four new supported states

play/assets/us-map.svg         regenerated
play/assets/scenes/new-river-gorge.svg
play/assets/scenes/mount-rushmore.svg
play/assets/scenes/vicksburg.svg
play/assets/scenes/newport.svg

SCENE_GUIDE.md                 status table + new lessons
SCENE_ROADMAP.md               Wave 7 marked built, Wave 8 candidates
HANDOFF.md                     this file
```

`tools/check-scenes.py` is unchanged. The SVGs are committed art — you don't need to run the
generator; it's included so the next batch has something to build on.

---

## Integration checklist

1. Copy the files above into place.
2. `python3 tools/check-scenes.py` — expect `ALL CLEAR` across 41 scenes.
3. `python3 tools/build-scene-gallery.py` — writes `tools/scene-gallery.html`, 41 scenes
   each rendered with a train running through it. Fastest way to eyeball the set.
4. `node tools/gen-map.js` — regenerates `play/assets/us-map.svg`. Needs `d3-geo`,
   `topojson-client` and `us-atlas`; if you'd rather not install them, take the committed
   `us-map.svg` from this drop.
5. Open `play/index.html` from `file://`, check the four new destinations appear in the
   picker and load, and confirm the gates still work from the buttons **and** the physical
   endpoint on each.

**No new rolling stock required.** Two of the four use `steam`, which already exists.

---

## Every one of these had to answer one question first

*Where is the level crossing?* Every scene in this game is a road meeting a railway, so a
location with no plausible crossing is not a location, however beautiful. All four have a
real answer, and it is worth recording because it is the filter that killed the alternatives:

- **New River Gorge** — Fayette Station Road switchbacks down the gorge wall, reaches river
  level, **crosses the railroad**, and turns onto the Tunney Hunsaker Bridge.
- **Keystone** — the terminus of the Black Hills Central Railroad, the 1880 Train. That
  railroad *hauled the equipment used to carve Mount Rushmore*, so the steam engine at this
  crossing is the descendant of the train that built the thing on the mountain behind it.
- **Vicksburg** — a KCS railroad town; the line crosses the Mississippi here on the 1930
  truss bridge and runs the waterfront below the bluff.
- **Newport** — the Old Colony & Newport Railway runs the waterfront and north up
  Aquidneck Island.

---

## Animation hooks

| scene | hook | what it is |
|---|---|---|
| `new-river-gorge` | `#river-path` | the line of the current, `M-60,396 L1340,402` |
| | `#cc-raft-0..2` | inflatable rafts with paddlers, running the rapids |
| | `#gorge-bridge` | the whole arch, if you ever want it to do anything |
| | `#bridge-road-path` | the deck of the arch, 876 feet up — `M-80,26 L1360,26` |
| | `#cc-gorge-car-0..6` | traffic crossing it: five cars and two trucks |
| `vicksburg` | `#river-path` | `M-360,356 L1640,362` — deliberately far wider than the frame |
| | `#cc-tow` | the towboat and its raft of barges as ONE group |
| | `#cc-driftwood-0..2` | logs on the current |
| | `#bridge-rail-path` | the railroad bridge deck, `M-160,262 L1440,245` |
| | `#cc-bridge-train` | a diesel-electric and four freight cars crossing it |
| | `#landing` | the riverfront apron, ramp and parked pickups beyond the floodwall gate |
| `newport` | `#bay-path` | the line the fleet sails along |
| | `#cc-sail-0..3` | **four** boats, each at its own size — all four are meant to move |
| | `#platform` | the platform edge, if you want to stop the train at the station |
| | `#station` | platform, canopy, depot, name board, waiting passengers, forecourt |
| | `#cc-car-0..3` | cars parked in the station forecourt |
| | `#forecourt-path` | road head → forecourt, for a car arriving at the station |
| | `#bridge-road-path` | the Pell Bridge deck, `M-80,270 L340,232 L900,232 L1360,266` |
| | `#cc-bridge-car-0..6` | traffic crossing it — six cars and a truck |
| `mount-rushmore` | `#keystone-street` | the town street, if you want traffic on it |
| | `#flag-avenue` | the banners, if you ever want them to stir in the wind |
| | `#granite` | the massif, clipped — anything added to the rock goes in here |
| | `#pinebelt` | the wooded ridge between the mountain and the town |

**There are TWO trains in Vicksburg.** The dark trussed span is the railroad bridge —
it carried US-80 until 1998 and is rail-only now — so there is a freight on it, exported as
`#cc-bridge-train` and running along `#bridge-rail-path`. It is deliberately independent of
the player's own train down at the crossing: two trains at two depths, moving at two
different speeds, and the far one should be **slow and steady**, crossing in twenty or
thirty seconds. The locomotive is a generic North American hood unit — no reporting marks,
no numbers, no livery.

**The tow is one group on purpose.** A towboat and its raft are rigidly lashed together —
they are a single vehicle a thousand feet long — so animating them separately would be both
wrong and painful. Slide `#cc-tow` along `#river-path` and everything moves as one. Keep it
**slow**: a loaded tow does about 6mph upstream, and the whole charm of the thing is that it
barely appears to move. If it crosses the frame in under a minute it reads as a speedboat.

**The sails want different speeds, not one.** `#cc-sail-0..5` are drawn at scales from 0.30
to 0.74, and the small ones are small because they are far away. Move the near ones several
times faster than the far ones or the bay will look like it is on a conveyor belt. They also
do not need to travel far — a slow drift across a third of the frame, then a reset, reads
better than a lap.

**The rafts should bob.** A tiny vertical oscillation, a couple of pixels at a couple of
cycles a second, sells the rapids more than horizontal speed does.

---

## Notes on the four scenes

**New River Gorge.** Drawn from the rim there is no scene at all — the road and the railway
are a thousand feet below you. So this is the canyon floor, and the composition rule that
matters is that **the walls have to converge**: two forested walls climbing steeply out of
both edges of the frame, squeezing the sky into a wedge, with the arch crossing that wedge.
The first pass drew them as a flat band across the back and the whole thing read as a lake
with a wood behind it.

The arch is **rust-brown weathering steel**, not grey, and against the green of the gorge
that rust is the entire colour story. You see it from below, so what reads is the underside:
the deck as a dark band on top, spandrel posts hanging beneath it, and the arch itself as a
two-chord lattice truss. Drawn as a single curved line it is a wire; drawn as a truss it has
mass.

The road stops at the white truss portal (`top=420`) — the same move as Quechee's covered
bridge.

**Mount Rushmore.** The carving is **not** drawn big, and that is the single most
important thing about this scene. It spans about 330px of the 1280 — a quarter of the
frame — and the picture is *the Black Hills with Rushmore in them*, not a portrait of four
faces with a town underneath. An earlier version spanned 555px and no amount of redrawing
was ever going to save it: a flat-vector scene has no gradient to model a face with, so at
that size every shape needed to describe a form has a hard edge, and a hard edge on a face
is read as a *feature*. That is where the headband, the second mouth and the accidental
grins all came from. Please don't scale the carving up. An earlier note in this project's own docs said to avoid
Rushmore on copyright grounds; that note was wrong and has been corrected in
`SCENE_ROADMAP.md`. It had lumped the carving in with the Rocky statue, and the two are not
comparable: Rocky is 1980, Rushmore was finished in **1941** under the old regime where
publishing without a copyright notice put a work into the public domain, and pre-1964 works
also needed a renewal at 28 years that there is no sign of. US freedom of panorama covers
buildings only, not sculpture, so that formalities argument is the one doing the work. We
draw it ourselves from reference and never trace a photograph — the photographer's copyright
is separate and alive. **The Black Hills monument to avoid is Crazy Horse**: privately
owned, still being carved, actively protective. Please keep it out.

The faces took nine attempts. The lessons are in `SCENE_GUIDE.md` and the short version
is: at this size identity is **silhouette plus four marks** — Washington's lapel and
three-quarter turn, Jefferson's raised chin, Roosevelt's pince-nez and walrus moustache,
Lincoln's beard. They are also **not all facing forward**, which is most of the likeness;
four frontal faces in a row is a totem pole however carefully each is drawn.

Two things that will bite anyone editing them. Features follow `mx`, the *turned* centre
line — only the skull outline follows the half-widths `wl`/`wr`, and hanging Lincoln's
beard off `wl` grew it out of the back of his head. And nothing on a carved face is ever
filled darker than one step below the cheek: Roosevelt's moustache was briefly near-black
and read instantly as a cartoon villain.

The road runs **all the way to the talus at the foot of the mountain** (`ROAD_TOP=308`).
The granite gateway that used to close it off is gone; what tells you the road leads
somewhere is the **avenue of flags** — plain coloured banners on plain poles, six pairs
receding up both kerbs. No seals, no emblems, no wordmarks, and please keep it that way.

Keystone is an explicit table (`SHOPS`), one shop each side at six depths, drawn far to
near. Three rounds of tuning a *placement loop* produced a street that was in turn
overlapping, then half-empty, then staggered on one side and not the other. A loop that
places buildings against a moving road edge does not converge; a table does.

The mountain silhouette is built from a **dome** with joint blocks cut into it, and every
piece of surface detail — fractures, pillars, spires, flank shading — is inside a
`clip-path` referencing that silhouette. Add anything to the rock and put it inside that
group, or it will hang in the open sky.

One more guard worth knowing about: the scene holds an `in_road(x, y)` predicate and every
procedural scatter runs through it. The road corridor is only a few pixels wide near the
horizon, and two pines out of a 260-tree band landed either side of the vanishing point and
closed the road off. `check-scenes.py` catches props on the *track* but nothing catches
props on the *road* — teaching it to would be a good small job.

**Vicksburg.** The hero is the **tow**, and its proportion is the whole thing: the boat is a
small square block at the back and the raft in front of it is fifteen barges lashed into a
slab riding almost awash. Drawn with a big boat and a few barges it turns into a tugboat,
which is a different machine on a different river.

The river went through three colour passes. Muddy brown, honestly rendered, sat at the same
value and hue family as the tan bank and the olive levee, and the Mississippi read as a
mudflat. What fixed it was making the water distinctly **greyer and cooler than every piece
of land around it**, plus the two things only water has: a dark reflection of the far bank
along its top edge and a wide silver sheen across it.

The road ends at a **floodwall gate** (`top=436`) — Vicksburg's concrete floodwall has
vehicle openings closed with steel leaves when the river comes up. They stand open here. The
wall is deliberately **plain**: the real one carries a celebrated set of painted murals which
are recent work by a living artist and firmly in copyright. Please do not add them.

And the gate opens onto **somewhere**: a riverfront **car park** along the water, with
marked bays, cars and pickups nose-in to the river, boat trailers, and a **ramp** — set well
off to the right, at x≈908, with a truck backing its trailer down it. A car through the gate
is parking, or launching. That is the answer to *where is it going*, and "the road ends at an
object" was never a sufficient version of that question.

**Three things about that end matter, and all three were got wrong first:**

1. **The ramp must not be on the road's centreline.** With it dead ahead, the eye reads the
   carriageway as continuing straight down into the river — and with the tow parked on the
   same axis, as driving *onto the barges*. The tow now sits left of centre and the ramp
   right of it, so nothing lines up with the road.
2. **A road that stops has to look stopped.** There is a continuous rail along the whole
   water's edge, broken only at the ramp, and a row of low concrete bollards square across
   the head of the road.
3. **Those bollards are deliberately low.** An earlier version put a chevron board up at
   rail height and it stacked visually with the crossing gate behind it, reading as a second
   gate. Anything placed on the road's axis near the crossing has to be clearly a different
   size from the gate.

There is deliberately **no second road** in this scene. An earlier version ran a Levee
Street horizontally across the frame, which fought the perspective of the game's own road
and put painted traffic exactly where the engine's cars will drive.

The near ground is the **grassed levee** that runs down from the town to the water: mown
bands, live oaks, benches facing the river, and the old cotton warehouses standing back on
gravel pads. Every one of those buildings sits WHOLE inside the frame — a warehouse sliced
by the canvas edge reads as a mistake rather than as a street continuing past it.

**Newport.** Rewritten from scratch, because the first version was wrong in four ways and
three of them were the same mistake: **nothing was measured**.

The road is 7.3m wide, so `ppm(y)` — pixels per metre — is known at every depth, and this
scene now sizes everything from it. That fixed:

* the **houses, which were five times too small** — 60px where 310px was right, which is
  why they came out shorter than the train;
* the **sails, which were half size** (a 12m sloop is a 120px hull, not 74);
* the **road, which ran into the harbour** — see the station note below;
* the **bridge, which stopped in mid-water** — the Pell Bridge's approach viaduct now runs
  off *both* edges of the frame, which is what a two-mile bridge does.

Getting the buildings right changed the whole composition. At 400px tall they can only be
**wings at the frame edges**, and that turns out to be the view every reference photograph
of Thames Street shows: a street canyon opening onto the water. It is also where the charm
lives — twelve-pane sash windows, striped awnings, hanging signs on wrought brackets, flags
angled over the street, window boxes, dormers, chimneys, gas lamps on the kerb and people on
the pavement. None of that is visible at 60px. All of it is at 400.

The near buildings are in **`foreground`**, deliberately: at that size anything in the
middle of the frame would hide the train, so they frame the picture from the sides and the
harbour opens between them.

One trap, twice fallen into in this scene: the granite pavement and its kerbs are painted in
**`ground`**, not `scenery-front`. `scenery-front` is drawn *after* the carriageway, so
ground painted there buries the road completely.


---

## What comes next

**14 states still have nothing**, so Wave 8 comes entirely from that column. The named
candidates are **Bailey Yard at North Platte, Nebraska** — the largest railroad yard in the
world, and an obvious subject for this particular game — and **Glacier, Montana**. Alabama,
Arkansas, Connecticut, Delaware, Iowa, Maryland, New Jersey, North Dakota, Oklahoma, South
Carolina, Virginia and Wisconsin have no candidate chosen yet.

Blocked by the ordering rule rather than rejected: **Philadelphia** (the Art Museum steps,
*not* the Rocky statue), **Portland**, **Louisville**, and the **South Dakota Badlands**.


---

## Newport has a station, and that is why the road works

The vertical budget in this scene decides everything, and it is worth writing down because
it applies to any scene where the road ends near the horizon.

**The far crossing gate stands at y=388 and reaches down to y=445**, so the road must exist
underneath it — `top` has to be above 388. Everything the road ends at therefore has to fit
between the horizon at 300 and that: **88 pixels, total.**

A T-junction does not fit in 88px. To show a car actually turning you need something like
50px of cross street, which leaves 38px for the entire harbour — and that is exactly why the
first version's junction was too narrow to read and why the crossing gate appeared to be
standing in it.

So the road does not turn. It crosses the railway and ends at the **station**: the platform
and depot run along the track to the left of the crossing, and the **forecourt** is on the
right, which is where the cars go. A level crossing at the end of a platform is one of the
most ordinary arrangements on any railway, and it makes the road's ending honest without
spending any of the harbour's depth.

It also gives the scene something no other location has: **somewhere for people to get on
and off the train.** `#platform` is exported as the platform edge, so the engine can bring
the train to a stand there — with the canopy, the benches, the name board and the waiting
passengers already drawn.

**And there are only four sailing boats now**, plus four on moorings and six along the
wharves. The first version had two dozen stacked on top of each other, which was a mess to
look at and would have been a worse mess to animate. Every boat in this scene is meant to
move, so every boat has room.


## The Pell Bridge carries CARS

Worth stating because it is the opposite of Vicksburg and the two are easy to confuse. The
Claiborne Pell Newport Bridge is a **highway** bridge — RI-138, four lanes, two each way,
opened 1969 — and **no railway crosses Narragansett Bay there at all**. It does not even
take pedestrians or bicycles. Vicksburg's big trussed span is the railroad bridge and carries
a freight; Newport's suspension bridge carries traffic.

So `#cc-bridge-car-0..6` are six cars and a truck on `#bridge-road-path`. They are **ten
pixels long**, and that is correct: the towers stand about 57m above the deck and measure
128px here, so a metre is 2.2px. Drawn any bigger and the bridge stops being two miles away.

Send some left and some right, slowly — at that distance traffic barely appears to move,
which is the same discipline as the tow at Vicksburg.

That gives Newport **three independent moving things at three depths**: sails drifting on
the bay, cars crossing the bridge, and the train at the crossing. It is a great deal of life
for three groups and three paths.


## Both big bridges in this wave carry CARS

Easy to get backwards, so: of the three big bridges in Wave 7, **only Vicksburg's is a
railway**.

| bridge | carries | what is on it |
|---|---|---|
| New River Gorge (WV) | **US-19**, four lanes | `#cc-gorge-car-0..6` |
| Vicksburg (MS), the 1930 truss | **railroad** (it carried US-80 until 1998) | `#cc-bridge-train` |
| Claiborne Pell (RI) | **RI-138**, four lanes | `#cc-bridge-car-0..6` |

At the New River Gorge the railway is not on the bridge at all — it is the old C&O along the
canyon floor, which is the line our own level crossing sits on. **The train is already in
that scene; it is 876 feet below the cars.** And the height stays: 876 feet is the entire
point of the place, and lowering the arch far enough to put a readable train on it would
trade the fact for the gag.

The traffic up there is deliberately minute. The deck is 267m above the water and 344px
above it in the frame, so a metre is 1.3px and a real car would be six pixels long. They are
drawn at nine — a small, deliberate generosity, because a moving speck of colour crossing
the sky is worth more to a three-year-old than arithmetic is. Run them slowly, both ways.
