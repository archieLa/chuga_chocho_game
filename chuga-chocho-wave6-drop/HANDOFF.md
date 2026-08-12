# Handoff — Wave 6

**Rolling doc.** It always describes what's new *since the last integration*. This one
assumes **Wave 5b** (Quechee, Detroit) is already in. If it isn't, integrate that one first
— this sits on top of it.

Two new locations, and they complete Wave 6. No shared furniture changed — `road()`,
`track()` and both gates are exactly what Wave 3 shipped, and nothing already in the game is
touched.

This takes Chuga Chocho to **37 destinations across 32 states plus DC**.

---

## What's new

| Scene id | State | Destination | Engine preset |
|---|---|---|---|
| `sun-valley` | Idaho | Sun Valley — Bald Mountain, the gondola, Ketchum in the snow | `diesel` |
| `indianapolis` | Indiana | Indianapolis — the main straight, the pit lane, the bricks | `diesel` |

Idaho and Indiana are new states on the map. Both had **zero** locations, which is what the
ordering rule requires.

Three firsts in one wave: the set's first **winter** scene, its first **aerial lift**, and
its first **motorsport**.

---

## Files in this drop

```
tools/gen-scenes.py            adds sun_valley() and indianapolis(); nothing else changed
tools/build-scene-gallery.py   catalogue + gradient-id namespacing for the two new scenes
tools/gen-map.js               SUPPORTED gains Idaho and Indiana

play/js/world.js               two new LOCATIONS entries

play/assets/us-map.svg         regenerated
play/assets/scenes/sun-valley.svg
play/assets/scenes/indianapolis.svg

SCENE_GUIDE.md                 status table + new lessons
SCENE_ROADMAP.md               Wave 6 marked built, Wave 7 reserves
HANDOFF.md                     this file
```

`tools/check-scenes.py` is unchanged. The SVGs are committed art — you don't need to run the
generator; it's included so the next batch has something to build on.

---

## Integration checklist

1. Copy the files above into place.
2. `python3 tools/check-scenes.py` — expect `ALL CLEAR` across 37 scenes.
3. `python3 tools/build-scene-gallery.py` — writes `tools/scene-gallery.html`, 37 scenes
   each rendered with a train running through it. Fastest way to eyeball the set.
4. `node tools/gen-map.js` — regenerates `play/assets/us-map.svg`. Needs `d3-geo`,
   `topojson-client` and `us-atlas`; if you'd rather not install them, take the committed
   `us-map.svg` from this drop.
5. Open `play/index.html` from `file://`, check both new destinations appear in the picker
   and load, and confirm the gates still work from the buttons **and** the physical
   endpoint on each.

**No new rolling stock required.** Both use engines that already exist.

---

## Sun Valley: the gondola, the skiers and the plough

The scene is built so the two things a small child will point at can move.

| hook | what it is |
|---|---|
| `#gondola-path-up` / `#gondola-path-down` | the two haul ropes, base station bottom-left to summit top-right |
| `#cc-gondola-up-0..3` / `#cc-gondola-down-0..3` | eight enclosed cabins, four climbing and four descending |
| `#chair-path-up` / `#chair-path-down` | the chairlift's two ropes, on the right-hand ridge |
| `#cc-chair-up-0..2` / `#cc-chair-down-0..2` | six open chairs with people on them |
| `#cc-plough` | the big highway plough in the near field, blade down, plume flying |
| `<path id="plough-path">` | the verge it is clearing — it stops short of the carriageway |
| `#cc-plough-far` | a second, much smaller plough working the town street |
| `<path id="run-path-0">` … `-6` | the seven ski runs, wobbled from side to side like a line of turns |
| `#cc-skier-<run>-<n>` | the skiers on them, with `data-run`, `data-t` and `data-s` |
| `<path id="street-path">` | the cross street through Ketchum, `M-80,371 L1360,371` |
| `#cc-car-0` … `-4` | the traffic on it, each with `data-x` / `data-y` / `data-s` |
| `<path id="road-approach-path">` | up the main road from the bottom of the frame to the junction |
| `<path id="turn-right-path">` | the junction → right along the cross street |
| `<path id="turn-left-path">` | the junction → left along the cross street |

**Both lifts run terminal to terminal.** Each has a base station at the bottom and a
bullwheel terminal at the top, and the rope stops a few pixels short of each so a cabin at
`t=0` or `t=1` is *inside* the building. A haul rope that ends in mid-air is the most
obviously wrong thing that can happen in a ski scene, and the first pass had exactly that.

**The traffic on the cross street is meant to move.** There are no parked cars on it — the
five vehicles there are side-on, each with its own id, and `#street-path` is a straight
line so walking them along it is one transform rewrite. The interesting move is the
**turn**: run a car up `#road-approach-path` from the bottom of the frame, shrinking from
about scale 1.0 to 0.34 as it recedes, then hand it to `#turn-right-path` or
`#turn-left-path` and finally onto `#street-path`. The three paths are authored to meet at
the same point (668, 388), so there is no seam to fudge.

**A lift is a loop, not a line.** Both lifts run *two* ropes side by side, offset
perpendicular to the line of the lift: cabins climb on the far one and come back down the
near one, which is also why each tower carries a pair of sheave heads. The two sets are
staggered half a cycle against each other so they pass rather than march in step. Animate
them in opposite directions — `t` increasing on the `-up` rope, decreasing on the `-down`
one — or the whole thing goes back to looking like a one-way conveyor.

**Every cabin and chair carries its own data attributes** — `data-dir`, `data-i`, `data-t`,
`data-s` —
where `t` is its position along the rope (0 at the base, 1 at the top) and `s` is the scale
it was drawn at. That is everything you need:

```js
const t2 = (car.dataset.t * 1 + dt) % 1;          // walk it up the rope
const x  = X0 + (X1 - X0) * t2, y = Y0 + (Y1 - Y0) * t2;
car.setAttribute('transform', `translate(${x},${y}) scale(${0.95 - 0.5 * t2})`);
```

The scale term matters. A cabin climbing away from the viewer must **shrink as it climbs**,
from about 0.95 at the base to about 0.45 at the top, or it looks like it is sliding along a
wire drawn on the sky rather than travelling up a mountain. `data-s` records the value each
one was authored at so you can check your formula against it.

Each rope is a straight line, so no path-length maths is needed — but all four are real
`<path>` elements if you would rather use `getPointAtLength()` and keep one code path with
Horseshoe Curve's `#curve-path` and the ski runs.

**The skiers.** Each run is exported as a real `<path>` that wanders from side to side
inside its corridor, so a skier walked along it with `getPointAtLength()` comes down in a
line of turns rather than straight down the fall line. Scale grows as they descend —
roughly `0.34 + 0.34·t` — because the bottom of a run is nearer the viewer than the top;
each skier records the value it was drawn at in `data-s`. When one reaches `t=1`, the
natural loop is to put it back at the top of the same run — or to send it up a lift first,
if you want to be thorough about it.

**There is deliberately no machinery on the mountain.** An earlier version parked a piste
groomer on a slope. It sat awkwardly among the trees, and more to the point its only
sensible animation path went straight through the skiers. The corduroy it would have left
is still drawn; the machine is not.

**The plough.** `#cc-plough` is a single group with its own `translate(x,y) scale(s)`, so
sliding it along `#plough-path` is one transform rewrite. That path clears the verge and
**stops at the carriageway**, so an animated pass never drives across the road or the
crossing. It faces left; to work the other way, mirror with `scale(-1,1)` inside a wrapper
rather than re-authoring it. Nothing else needs to change while it moves — the berm it has
thrown is drawn under it and reads correctly wherever it stops.

---

## The Speedway: a car pulls in for a wheel change

This was the explicit brief, so the geometry for it is exported rather than left to be
reverse-engineered from the art.

| hook | what it is |
|---|---|
| `<path id="racing-line">` | the line the cars run, `M-80,390 L1360,386` — straight across the frame |
| `#cc-racer-0` … `-5` | the six cars running the straight, left to right |
| `<path id="pit-in-path">` | track → pit lane, a curve up and right off the racing line |
| `<path id="pit-lane-path">` | along the lane, right to left, `M1280,318 L-60,318` |
| `<path id="pit-out-path">` | lane → track, rejoining the racing line on the left |
| `<circle id="pit-box-stop">` | the stop point, `cx=430 cy=318` — the box with the crew already in it |
| `#cc-racer-pit` | the car currently stopped there, in case you'd rather reuse it than spawn one |
| `#cc-racer-entering` | the car coming out through the access gate onto the circuit |
| `#access-road` | the paved apron running from the gate up onto the racing surface |
| `#paddock-left` / `#paddock-right` | the two queues of cars waiting their turn on the grass |

**The band geometry, since you will need it.** The pit lane centre is at **y≈318** and the
racing line at **y≈390**, so a car pitting moves *up* the canvas by about 72px — away from
the viewer. It should therefore get **smaller**, from the 0.62–0.68 the pack is drawn at to
about 0.50, which is what `#cc-racer-pit` uses. Interpolate scale along with position or the
car appears to grow as it drives away.

A sequence that works, in order:

1. the crossing gates come down and the train runs as usual — the race carries on behind it,
   which is the whole charm of the scene;
2. pick a car, say `#cc-racer-3`, and walk it right along `#racing-line` until it reaches
   the pit entry at about x=1060;
3. follow `#pit-in-path` up into the lane, easing scale 0.65 → 0.50;
4. run left along `#pit-lane-path` and stop on `#pit-box-stop`;
5. hold for a second or two — **the crew and the equipment are already drawn there**, so a
   wheel change needs no new art at all. If you want the wheels to actually come off, the
   two front-most crew figures stand at the wheels and there is a spare tyre and a fuel hose
   in the box beside them;
6. run back out along `#pit-out-path` and rejoin the racing line.

Hide `#cc-racer-pit` while your animated car is in the box, or you will have two cars in one
stall.

**Everything here is generic.** No badges, no logos, no wordmarks, no team liveries, no real
car shapes; the tower at start-finish is a plain tiered control tower and the scoring pylon
is an abstract column of amber cells rather than running numbers. Trademarks matter for a
free, open-source project — the same reasoning that ruled out the Rocky statue in
Philadelphia. Please keep it that way if you extend the scene.

---

## Notes on the two scenes

**Sun Valley.** The set's first snow, and almost everything that was hard about it was
contrast rather than drawing. White spray in front of white snow is invisible; so is a
chalk-white aspen trunk on a white field, and so is a snow berm along a white verge. Every
one of them carries a pale blue edge so that it exists at all. And snow shadow is **blue**,
never grey — grey shadow on white reads as dirt.

Bald Mountain is a whaleback, not a peak: the crest is a smooth curve through the summits
with four control points inside a hundred pixels at the top, and the lit and shaded flanks
are separated by a broad soft band rather than a hard line, because a crisp split running to
a single apex makes even a perfectly rounded mountain read as a pyramid. The timber on the
face is about six hundred individual little trees scattered from below the treeline down to
the valley, and **the ski runs are the gaps the timber leaves** — which is how runs are
actually cut.

The road runs into Ketchum's main street (`top=378`) and stops at it, with the cross street
ploughed to bare tarmac, cars parked nose-in and a bank of snow behind them.

**Indianapolis.** An oval is two and a half miles round and the canvas is 1280 wide, so
drawing "the oval" gets you a grey ring in a green field. This is the view along the main
straight from *outside* the track — which is also the only place a level crossing could
plausibly be — and the depth order is the whole scene:

> grandstand across the way · Pagoda · garages · pit lane · pit wall · track · catch fence ·
> the grass we are standing on

The first version had the pit lane in front of the track, which only happens if you are
standing in the infield, and then the Pagoda would have been behind your head.

The crowd is deliberately **pale with colour through it** and sits in rows; rendered as
bright dots at random it turns into confetti and the grandstand stops reading as raked
seating. The catch fence is at about a fifth of the opacity a camera would give it, because
at full strength it becomes a cage over the picture and the cars behind it go grey.

**The road is the track access road.** A road that simply stops at a gate begs the
question, and at a circuit the honest answer is that this is how cars get onto the tarmac:
the carriageway carries on through the opening (`top=432`) as a paved apron with chevrons
down its edges, running up onto the racing surface, with a marshal waving and a car already
half way out. The two queues on the grass either side are the cars waiting their turn.

That also fixes a scale error worth recording: the first version put ordinary spectator cars
on that grass and they came out *smaller than the people standing next to them*. An
open-wheel car is about two and a half times a person long and a little over half a person
tall — every vehicle in the near field is now drawn from that one rule.

---

## What comes next

The ordering rule is unchanged: **a state with 0 locations beats a state with 1, and a state
with 1 beats a state with 2. No state gets a third until every state has at least one.**
**18 states still have nothing**, so the next batch comes entirely from that column.

Held as reserves, all from empty states: **West Virginia's New River Gorge**, **the
Mississippi at Vicksburg** (a towboat pushing a raft of barges — the set still has no
Mississippi and no river traffic), **the South Dakota Badlands** (framed as the Badlands,
*not* Mount Rushmore — that carving is from 1941 and its copyright status isn't clean enough
for this project), and **Newport, Rhode Island** (the set has no sail).

Held at the front of the queue but blocked by the rule rather than rejected: **Philadelphia**
(the Art Museum steps, *not* the Rocky statue), **Portland**, and **Louisville**.
