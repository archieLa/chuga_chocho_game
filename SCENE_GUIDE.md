# Scene Authoring Guide

**How to build a location scene for Chuga Chocho so it matches the rest.**

`play/assets/scenes/colorado.svg` is the **reference implementation**. When in doubt, open it and copy its structure. This guide exists so a new scene can be authored from scratch — in a fresh session, by a new contributor — and land visually and technically consistent with the others.

Read `DESIGN.md` §3 (art direction) and §6 (locations) first for the *why*. This document is the *how*.

---

## 1. Canvas & shared geometry

Every scene is a **1280 × 720** SVG (`viewBox="0 0 1280 720"`). These values are **fixed across all scenes** — the road, track, and gates must line up identically everywhere, because the game engine drives them with shared coordinates.

| Element | Value |
|---|---|
| Horizon | `y = 300` |
| Track bed | `y = 450` → `516` (66 tall); top highlight 8px |
| Rails | `y = 466` and `y = 496` (6 tall, `#d3d7dc`) |
| Ties | 15 wide × 62 tall, every 44px, `#6b4a2a` |
| Road (perspective) | polygon `510,720 · 770,720 · 658,300 · 622,300` |
| Road centre | `x ≈ 640` (vanishing point on the horizon) |
| Near gate posts | `x = 552` and `x = 728`, `y = 480`, `scale(1.2)` |
| Far gate posts | `x = 580` and `x = 700`, `y = 388`, `scale(0.82)` |

**The road is a perspective ribbon** that narrows to a vanishing point *on the horizon*. It never runs full-height, and mountains always sit **behind** it. This is what stops the road from appearing to cut through the landscape.

**Two crossing gates**, one on each side of the tracks — the near gate (below, larger) blocks cars approaching from the bottom; the far gate (above, smaller) blocks cars from the top. Cars travel in **both directions**. Both gates lower together. The size difference is deliberate: it sells depth *and* is geometrically correct.

---

## 2. Layer order (the depth model) — get this right or the game breaks

SVG paints in document order. The engine renders the moving train **between `#gate-far` and `#scenery-front`**, so the scene must be structured exactly like this:

```
#sky              gradient, sun, clouds, birds
#far-peaks        distant snowy summits
#slopes           forested hills, seasonal colour, ravine
#bridge           (optional) the location's signature landmark
#ground           grass fields + contour shading
#creek            water features
#scenery-back     TREES BEHIND THE RAILS  ← trunks at y ≈ 385–400
#road             perspective road (drawn AFTER background scenery)
#track            rails + ties
#gate-far         far crossing gate
   ▲▲▲  ENGINE RENDERS THE TRAIN HERE  ▲▲▲
#scenery-front    foreground props      ← bases at y ≥ 510
#gate-near        near crossing gate
#foreground       grass tufts, close flowers
```

### The three depth planes

1. **Behind the train** — trees and scenery planted *beyond* the rails. Trunk bases sit **above** `y ≈ 400`, so the train passes in front of them.
2. **The train corridor** — `y ≈ 450–516`. **Keep this band clear.** No trunk, rock, or prop may sit on the rails, or the train will visibly pass through it.
3. **In front of the train** — foreground props with bases **below** `y ≈ 510`: boulders, landmarks, bushes, flowers.

> **The single most common bug:** placing a tree or rock so its base lands inside the track band. It looks fine as static art and breaks the moment the train moves. Always check the `450–516` band before finishing.

The **road is drawn after `#scenery-back`** so background trees can't poke through the tarmac.

---

## 3. Reusable pieces (`<defs>`)

Copy these from `colorado.svg` and extend per location. Each already includes its **grounding shadow** (a low-opacity ellipse at its base) — that's what stops props from looking like floating stickers.

| id | What it is |
|---|---|
| `pine` / `pineDark` | conifers (two tones for depth) |
| `aspen` | white trunk with black eye-marks, gold canopy |
| `rock` | small faceted stone |
| `boulder` | large granite boulder, faceted, with lichen dabs |
| `redrock` | red sandstone formation (Red Rocks / Garden of the Gods) |
| `bush` | rounded shrub cluster |
| `columbine` | Colorado state flower (blue/white/yellow) |

Gradients: `sky`, `sun`, `grass`, `road`, `water`.

New locations add their own (`palm`, `cactus`, `saguaro`, `liveoak`, `skyscraper`, …) in the same style: flat shapes, one light tone + one shadow tone, a grounding shadow, no gradients inside props.

---

## 4. Art direction rules

- **Flat storybook illustration.** Solid fills, gentle gradients for sky/ground/water only. No textures, no blur, no 3D.
- **Light comes from the upper right.** Shadow facets on the left, grounding shadows offset slightly left.
- **Recognisable over realistic.** A child must identify the *place* and the *train type*. Silhouette matters more than detail.
- **Three-value shapes.** Base tone, lighter lit face, darker shadow face. That's enough to read as form.
- **Grounding shadows on everything** that touches the ground.
- **Density gradient.** Sparse and small near the horizon, larger and denser toward the foreground.
- **Nothing overlaps the road corridor.** Scenery stays in the left and right fields.

### Colour discipline

Sample from the reference rather than inventing: warm peaks `#c2a069` with `#a5834b` shadow faces and `#f7fbfe` snow; evergreen slopes `#3f7c53` / `#4a875b`; grass `#8ec96a → #6faa4e`; road `#6a6a6f → #54545a`; water `#cdeafb → #8fc7ec`.

**Get the regional rock colour right** — Rocky Mountain peaks are warm tan/ochre, *not* grey. Each region has a characteristic palette; that's half of what makes a place recognisable.

---

## 5. Recipe for a new location

A scene reads as a *specific place* when it carries these five, and reads generic when it doesn't:

1. **ONE signature landmark — two at the very most.** The one thing that says "this is here."
   Colorado: the Georgetown Loop trestle. San Francisco: the Golden Gate. Chicago: the skyline
   and the 'L'. Make it prominent, not shy.

   **Do not stack famous things.** The strongest temptation is to cram in every landmark a
   place is known for — and it is exactly what ruins a scene. San Francisco first shipped with
   the Golden Gate *and* Lombard Street *and* a tech tower all competing, and the result read as
   a souvenir shelf rather than a place: with several heroes there is no hero. It was fixed by
   deleting two of them.

   Everything that is not the hero should be **supporting texture** — generic in form but
   regional in character, the ordinary fabric of the place. A row of colourful Victorians, brick
   low-rises, brownstone stoops with water towers, palms and beach umbrellas, live oaks with
   Spanish moss. Texture is what makes a place *feel* right; the single landmark is what makes
   it *identifiable*. You need both, in that ratio.
2. **Characteristic flora** — golden aspens and pines (Rocky Mountains), rim pines and saguaro (Grand Canyon), evergreens (Seattle), live oaks (New Orleans), palms (Los Angeles).
3. **Characteristic geology & palette** — tan Rockies, red sandstone, ocean blues, grey city concrete.
4. **A water or terrain feature** that ties the composition together — Clear Creek links the mountains to the foreground pond; the bay, the lake, the bayou play the same role elsewhere.
5. **A regional/seasonal cue** — fall aspen gold, desert heat haze, coastal fog, snow.

**Truth about the place beats variety across the set.** These two pull against each other,
and when they do, **truth wins**. Never strip something authentic out of a place because
another place already has it. Savannah has live oaks dripping with Spanish moss and so does
New Orleans — that is a fact about the American South, not a mistake to design around. Both
get their moss. Pennsylvania has a big red barn and so does Wisconsin; both get their barn.

Distinctiveness is bought with **the hero, the palette, the light and the composition** — not
by withholding true things:

| Lever | Example |
|---|---|
| Different hero | Savannah's fountain under the oaks vs New Orleans' cathedral and river |
| Different palette | Savannah's spring green and white vs NOLA's sunset gold |
| Different light | Nashville late afternoon, Austin sunset, Las Vegas full night |
| Different composition | Florida's rocket vertical on the pad vs Houston's hardware parked flat on grass |
| Different ground | LA's dry sand vs Delaware's boardwalk vs Maine's wet granite |

If after all that two scenes still read alike, the answer is to strengthen the hero of each —
not to take the moss off the oaks. A child who sees a live oak in two Southern states has
learned something correct about the South.

**Be true to what the place actually is — especially the GROUND.** The single biggest
mistake is dropping every location onto the same green lawn. Ground cover is half of what
makes a place read correctly:

| Place | Ground should be |
|---|---|
| Rocky Mountains | meadow grass, rock, creek |
| New Orleans | paved streets, kerbs, green "neutral ground" strips |
| Los Angeles | sand, promenade, beach |
| Chicago | asphalt, concrete sidewalks, a park strip as accent |
| Grand Canyon | dry rim dirt and rock |

Match the real density too. Chicago is overwhelmingly built — streets, brick, steel, towers —
with green as an *accent*. A beach town is mostly sand. Getting this right does more for
recognition than any single landmark.

**Cohesion test:** do the elements *relate* to each other (creek flows from the ravine under the track into the pond), or are they scattered independently? Related elements read as a place; scattered ones read as a sticker sheet.

### Per-location checklist

- [ ] Shared geometry unchanged (horizon, road, track, gate positions)
- [ ] Layer order matches §2, with the train slot after `#gate-far`
- [ ] **Track band `y = 450–516` is clear of all props**
- [ ] Nothing overlaps the road corridor — **run `python3 tools/check-scenes.py`**, which
      computes the carriageway width at each prop's own `y` and flags anything standing in it.
      Eyeballing this fails: the road narrows with distance, so a bench that looks clear at the
      top of the frame is in the middle of the lane at the bottom.
- [ ] Signature landmark present and prominent
- [ ] Region-correct rock/ground colours
- [ ] Grounding shadows on every prop
- [ ] Both gates present
- [ ] **If there is water near the horizon, LAND sits behind the road's vanishing point** — a
      waterfront, seawall, promenade or bluff. Otherwise the road appears to run into the sea.
      (This one bit LA, New York and Seattle in turn.)
- [ ] **The band between the horizon feature and the track is not empty.** The strip from
      `y ≈ 300` down to `y ≈ 440` is the second-largest area in the frame, and left bare it
      reads as a blank apron that drains the whole scene. Fill it with the *fabric* of the
      place, at small scale: a row of buildings, a forest, a promenade with people on it, a
      bike path with cyclists. Seattle needed greenery here, Colorado needed a full forest,
      LA needed towels and sunbathers. Ordinary things, densely placed — not more landmarks.
- [ ] Renders correctly (screenshot it — see §6)
- [ ] Well-formed XML

---

## 6. Workflow

Author the SVG by hand, then **always render and look at it** — bugs like sliced trees are invisible in source.

```bash
npm install playwright        # once
```

```js
// scene-shot.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();               // or executablePath for a system Chromium
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('file:///abs/path/play/assets/scenes/<name>.svg');
  await p.screenshot({ path: 'scene.png' });
  await b.close();
})();
```

Validate before committing:

```bash
python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('play/assets/scenes/<name>.svg'); print('ok')"
```

Iterate: render → review → adjust → re-render. Colorado took eight passes. That's normal and expected — the review loop *is* the process.

---

## 7. Lessons learned (don't repeat these)

| Mistake | Fix |
|---|---|
| Full-height vertical road | Perspective road to a vanishing point at the horizon |
| Road appears to cut through mountains | Mountains behind the horizon; road recedes toward them |
| Trees/rocks sliced by the track | Track drawn *before* foreground props; nothing in the `450–516` band |
| Landmark invisible behind the track | Put it in `#scenery-front` as a foreground element |
| Grey mountains | Warm tan/ochre for the Rockies; region-correct rock colour |
| Waterfall reads as a glass/ramp | Meander it around boulders with white break-water |
| Scene feels generic | Add the signature landmark + regional flora + seasonal cue |
| Elements feel disconnected | Link them (creek flows from ravine → under track → into pond) |
| Props look like floating stickers | Grounding shadows |
| Only one crossing gate | Two gates, cars from both directions |
| A canyon reads as a striped wall | Stack **promontories** — near, dark and jutting in from both sides; middle; far — so the eye reads a void between them. Horizontal strata alone always flatten. |
| A city block looks like scattered houses | Make it a continuous **wall** of buildings with a taller rank glimpsed behind it. Cities have no gaps at street level. |
| A scene reads generic no matter what you add | **Name the viewpoint.** Not "Alaska" — *the Alaska Range from the Susitna flats near Talkeetna*. Every scene that works in this set is a specific place seen from a specific spot. Without one you end up assembling a bag of regional objects instead of drawing somewhere, and no amount of extra detail fixes it. |
| A desert reads as a green field with rocks on it | The desert's ground **is** the subject. Draw bare stone — overlapping lopsided swells, each lit on one shoulder and shadowed on the other, at four or five different sizes — and let plants be the exception dotted into it. An even scatter of trees on flat orange is savanna, not slickrock. |
| Rock banding turns into a bullseye | Don't build a rock from nested outlines of itself. One shape, one lit face, one shadowed face, and at most two faint bedding lines *following* the curve. Concentric rings read as a target every time — Moab's first pass was five of them per swell. |
| A desert tree looks like broccoli | Junipers and piñons are ragged: notch the canopy outline, make it wider than tall, drop the green towards grey, and hang one dead silver limb off the side. A smooth round canopy on a straight trunk is a park tree wherever you put it. |
| An enormous cliff needs a recess | Use a **ledge that spans the whole face**, not an oval alcove. A closed lens shape floating on a wall reads as a painted eye; a horizontal step reads as rock because it crosses the fluting. |
| A street-level building disappears | In a city scene the ground layer's asphalt starts at the **horizon**, so anything put in `mid` gets buried by it. Street-level buildings belong in the same layer as the street, drawn straight after the road surface. Cost me a full render on Nashville. |
| Cars end up parked on the pavement | Leave a **traffic lane**. If the building line sits hard against the track band there is nowhere for a car to be, and every prop drifts onto the footway. Push the block up thirty pixels and the street reads instantly. |
| A projecting sign reads as a coloured pill | Size the **sign** first and the building second. A neon blade squeezed into a short façade came out 24px tall and read as a lozenge; the fix was taller buildings, not a cleverer sign. |
| A drawn guitar reads as a snowman | Two equal circles stacked is a snowman. The lower bout must be clearly bigger than the upper and the waist only shallow — the same rule as any waisted shape. |
| The road runs straight into water | Then it has to cross on something. Give it a deck, footways, piers and a parapet — and derive **both** rails from one function of y. Getting the sign backwards on one of them put a row of posts out in the open river. |
| A bridge dissolves into the frame | A bridge has to **land**. End the deck at the bank with an abutment rather than running it to the bottom edge; otherwise it reads as a grey ribbon painted on the water. |
| A low brick city loses its towers | Boston, Philadelphia, Baltimore. The continuous row-house wall will eat the skyline if you let it — keep the wall genuinely low and let the two or three tall things be genuinely tall. Half the character of these places is that contrast. |
| Ground clutter grows out of an animal's back | Draw **all** the ground clutter — sage, tufts, pebbles, litter — *before* any animal or hero prop, not in a second pass afterwards. I have now made this exact mistake three times, because the tidy way to write the code is to add the extra scatter at the end, and the tidy way is wrong. Clutter first, always. |
| Mountains read as a row of Christmas trees | Evenly spaced symmetric peaks always do. Make each one asymmetric — one flank long, one short — put the summits at wildly different heights, and run the shadowed flank **all the way to the base** rather than stopping at the dip. That last part is what gives a range mass instead of a row of cones. |
| A snow cap looks like a paper hat | Give its lower edge real zigzag, and add two or three small patches just below the snowline. But derive their position from the *local* slope height, not the summit's — computed from the summit they shoot out past the ridgeline and hang in the sky as white sticks. And no vertical rock rib down the middle of each summit; it reads as a zipper. |
| A river runs under the road | Then it looks like a leak. Bend it away before the crossing and run it off the side of the frame, or hide its end behind a rise. The road is the one thing in this game that cannot be crossed casually. |
| A vast place feels small and cosy | Two causes, both mine on Alaska. **A white peak sitting straight on the waterline reads as a nearby hill** — you need a band of dark foothills between it and the viewer to buy the distance. And **a continuous hedge of trees kills scale**: taiga is patchy, so leave wide open gaps and let the land breathe. |
| One mountain does not say "mountains" | Where a place is *made* of ranges — Alaska, Montana, the Cascades — stack three or four ridgelines at different values, each jagged and irregular. A single peak, however big, reads as a landmark; overlapping ranges read as a country. |
| An autumn scene only has colour on the ground | Autumn is in the **canopy**. Give the deciduous trees the gold — birch, cottonwood, aspen — and leave the conifers dark green. The contrast between gold crowns and black-green spruce is what reads as a northern autumn; orange ground under green trees reads as nothing. |
| A swarm/flock reads as smoke or a smudge | Put it **against the bright part of the sky**, never over a dark silhouette, and build it from a dense *core* plus a loose *halo* in several opacity bands. Austin's bats only worked once the plume was moved off the skyline and over the sunset. |
| Two white things overlap and read as one blob | Give the nearer one a **dark underside**. The shuttle vanished into the 747 until its black belly tiles went in — one dark edge did what no amount of outlining could. |
| A prop parks on top of the hero | Draw order inside a layer is depth. Emit the car park, treeline and background clutter **before** the hero, or a parked car ends up sitting on the wing. |
| Every light in a night scene has a big halo, and the picture turns to soup | Glow radii want to be **roughly the size of the fixture**, not five times it. Three stacked haloes at ~1.5× / 1.0× / 0.55× the source radius, with the outer one under 5% opacity. Vegas was unreadable until the haloes came down by two-thirds. |
| Reflections on a wet road read as light shafts | Start the smear **below its own light source**, not at the horizon, and keep it short. A reflection that runs the full height of the frame stops looking like the ground and starts looking like a beam. |
| A dusk or night scene looks like daylight turned down | Everything in shadow goes **dark and blue**, and the only saturated colour comes from actual light sources — bulbs, windows, neon, the sun. Warm pooled glows around each light source are what sell it. |

---

## 8. Status

| Location | State | Status |
|---|---|---|
| Rocky Mountains | CO | ✅ Reference scene — the style anchor (hand-authored) |
| San Francisco | CA | ✅ Golden Gate Bridge across the bay, rolling fog |
| Los Angeles | CA | ✅ The Pacific, Muscle Beach, volleyball, HOLLYWOOD on the hills |
| Chicago | IL | ✅ Skyline, elevated L, Navy Pier and the Centennial Wheel on the lake |
| Grand Canyon | AZ | ✅ The void framed by near promontories, temples, Watchtower, rim trail |
| New York City | NY | ✅ Brooklyn Bridge, full skyline, a solid block of brownstones and walk-ups |
| Seattle | WA | ✅ Space Needle, Mount Rainier, ferry, drizzle |
| New Orleans | LA | ✅ French Quarter balconies, streetcar, live oaks |
| Austin | TX | ✅ A million bats off the Congress Avenue Bridge at sunset, the Capitol dome |
| Houston | TX | ✅ The shuttle Independence riding a 747, a Saturn V on its side, hazy Gulf summer |
| Cape Canaveral | FL | ✅ A rocket off Pad 39, the VAB, saltmarsh, lagoon and a gator |
| Oʻahu | HI | ✅ Diamond Head over the Waikīkī reef, outriggers, the Duke, hula |
| Denali | AK | ✅ The Alaska Range from the Susitna flats, aurora over a spruce valley |
| Las Vegas | NV | ✅ The Strip after dark — hot neon on wet asphalt |
| Moab | UT | ✅ Delicate Arch from the slickrock, the La Sals behind, Highway 128 under the wall |
| Nashville | TN | ✅ Lower Broadway, honky tonk neon on Victorian brick, late afternoon |
| Boston | MA | ✅ Back Bay across the Charles from Cambridge, early autumn |
| Yellowstone | WY | ✅ The Lamar Valley herd under the Absarokas, geyser and thermal ground |
| Washington | DC | ✅ The Tidal Basin at cherry blossom, brick neighbourhood, Rosslyn beyond |
| Miami Beach | FL | ✅ Ocean Drive — Deco pastels left, Atlantic right (first asymmetric scene) |
| Duluth | MN | ✅ The Aerial Lift Bridge over the ship canal, a thousand-footer standing off |
| Wheat Country | KS | ✅ The elevator on its siding under towering flat-based cumulus |
| Kansas City | MO | ✅ Union Station from the Liberty Memorial lawn, fountains, Power & Light |
| Gatlinburg | TN | ✅ Six ridges receding above the Parkway, fog lying in the valleys |
| Horseshoe Curve | PA | ✅ The line thrown right round the head of the valley, a train wrapped round it |
| Crater Lake | OR | ✅ The caldera from Rim Drive, Wizard Island, a blue darker than the sky |
| Bluegrass | KY | ✅ White board fence over rolling pasture, a show barn, thoroughbreds |
| Mount Washington | NH | ✅ The Cog Railway ruled straight up a bare dome, engine pushing, Jacob's Ladder |
| Cedar Point | OH | ✅ The brick midway under a coaster skyline, crossed by the park's own railroad |
| Savannah | GA | ✅ A square seen from under the live oaks, Spanish moss hanging across the frame |
| Stonington | ME | ✅ The town landing on Deer Isle, fish houses on pilings, the lobster fleet |

**Thirty-one built.** Thirty are generated by `tools/gen-scenes.py`, which owns the shared
furniture (road, track, both gates) so geometry can't drift and a gate can't go missing;
each scene supplies only its artwork, slotted into the correct depth layers. Colorado stays
hand-authored as the reference. Verify with `tools/build-scene-gallery.py`, which renders
every scene with a train running through it.

### Lessons from the Duluth / Kansas / Kansas City / Smokies batch

- **Fog goes in the saddles, and it has to be computed.** Hand-placed white bands drift into
  a cloud deck that erases the layering. The Smokies fog is generated by walking the
  ridgeline's own knots, finding the local low points, and dropping one short patch on each —
  seated so its lower half pools inside the ridge and only its top edge rises past the crest.
  Float a patch clear of the crest and it reads as a lens cloud parked in the sky.
- **Draw order kills fog.** Each ridge polygon fills all the way down to the horizon, so any
  atmosphere drawn at the FOOT of a ridge is painted over by the next one forward. The band
  belongs on its own ridge's crest, emitted immediately after it.
- **Straight-line ridgelines give you Christmas trees.** The Smokies are three hundred million
  years old and rounded off. A smooth curve through the knots is the whole difference between
  Tennessee and the Alps — but keep the amplitude large, or rounding flattens the range into
  featureless bands with nowhere for the fog to lie.
- **Water needs a shape, not a rectangle.** A rect of blue in the grass reads as a fish tank
  sunk into the lawn. The Little Pigeon is a flowing polygon, and its white water runs in
  streaks ALONG the current — round white blobs scattered on it read as lily pads.
- **An animal is its silhouette.** The bear was a hedgehog until it got a rump higher than its
  shoulder, a head carried low and forward, a straight tan muzzle, and four legs you can count.
- **Rhododendron is not a cherry tree.** Dense dark leaves with a few fat magenta trusses
  sitting ON the mound; pale pink dots floating in the air is a different plant and a
  different scene.
- **A repeated building is wallpaper.** The Parkway strip only stopped reading as one shop
  photocopied sixteen times once width, height, roof colour, awning, sign colour AND baseline
  all varied — the baseline especially, so the ones behind sit higher up the hill.
- **Cylinders need per-unit shading.** Kansas's elevator was a flat slab until each silo got
  its own light-mid-dark banding.
- **Check what paints nothing.** Kansas City had a white band at y310–388 simply because no
  layer covered that region. If a strip of the canvas looks wrong, first ask what is drawing
  there at all.

### Lessons from the revision round

- **Put the landmark where the road isn't.** Union Station centred on the canvas planted its
  left wing in the carriageway. The road's vanishing point is at x≈634, not 640, and every
  building has to be checked against the corridor at its own baseline, not at the horizon.
- **Same reason the Duluth bridge was wrong.** A portal centred on the canvas leaves the road
  visibly off to one side of it; the towers have to be centred on the ROAD.
- **A station has to have trains.** Union Station without a shed, platform canopies or coaches
  was a handsome civic pile facing a lawn. The same applies to any building whose whole
  identity is what happens behind it.
- **A repeated building is wallpaper, and varying the colour is not enough.** Gatlinburg's
  strip and Duluth's warehouses only stopped reading as one building photocopied N times once
  the SILHOUETTE varied — chalet gable vs flat parapet vs log cabin; stepped gable vs pitched
  roof with a water tank vs corner turret.
- **Don't put a tree in the river.** Anything placed near a water shape has to be checked
  against that shape, not just against the road corridor.
- **A few specimen trees on grass is a park, not a forest.** Where the reference shows woods,
  draw a mass: many trees, clustered, varied in size, sorted back-to-front by baseline so the
  near ones overlap the far ones. And size them against the layers above — a tall conifer
  placed just below the track band grows straight up through the railway.
- **Skyscrapers are a claim about a city.** Duluth has none; Washington has none either (the
  towers you can see from the Tidal Basin are in Virginia). Drawing them turns a specific
  place into generic downtown.

### Three rules that are now enforced by the checker

- **Nothing in `scenery-back` may have its baseline inside the track band (y 450–516).**
  The track is drawn after that layer, so a prop planted there gets its feet buried in the
  ballast and reads as standing on the rails. Duluth had five brick warehouses doing exactly
  this. `check-scenes.py` now fails the scene. `scenery-front` is exempt — it draws in front
  of the track on purpose. Canal Park buildings belong there; Park Point's belong across the
  water at the far pier.
- **A tree's height is capped by its baseline.** A hemlock is 104 units tall at scale 1, so
  planting one at y=566 at scale 0.62 puts its crown at y=502 — inside the track band. Work
  the scale out from the baseline: `s ≤ (y − 522) / height`.
- **The road corridor is not the only forbidden shape.** Anything near water has to be tested
  against the water polygon too. Half the Smokies treeline stood in the creek because it was
  only ever checked against the carriageway. The fix was to move the creek into the bottom-left
  corner so there was an actual bank to plant on, then place every tree against both shapes.

### Buildings need a flank

The scene is one-point perspective with its vanishing point at **(634, 300)**. A building
standing off to one side has to show the flank that faces the middle of the picture, or it
reads as a stage flat propped up on the grass. `warehouse()` now derives the flank
automatically: normalise the direction from the building to the vanishing point, run the
block back along it by ~0.4·width, and draw the side wall, its parapet and a receding rhythm
of windows before the front elevation.

### Apparent size has to agree with depth

Duluth had a row of small blocks at y≈594 and two big ones at y≈706. Those baselines are
barely any depth apart — 0.70 versus 0.97 along the road's depth parameter — yet the near
pair were three times the apparent height, so they read as giants with a model village
behind them. Two ways to get this right:

- **Work apparent height from depth, not from scale.** At depth ratio 0.72 the far rank
  should be roughly 0.72× the near rank's apparent height, not 0.35×.
- **Check there is room for the building at all.** Nothing full-size can stand at y≈594 on
  this canvas, because it would have to cover the railway. That is a sign the composition is
  wrong, not the scale: the street was rebuilt to run away from each bottom corner toward
  the crossing, so the buildings have somewhere to be and the grades come out naturally.

Draw ground-level furniture BEFORE the buildings that overlap it. Trees added afterwards
ended up perched on the rooftops.

### One hero, and everything else at its own depth

Kansas City had the Liberty Memorial at 0.86 in the near foreground, competing with Union
Station and belonging to no plane of the picture. Pushed back to 0.58 and set on the same
line as the Crossroads brick, it reads as what it is — the tall thing on the hill behind the
district — and the composition finally holds together. If a scene feels incoherent, look for
a second object claiming to be the hero.

### Lessons from Wave 3

- **The road's vanishing point decides the composition.** It sits on the horizon at x≈634,
  so whatever is at (634, 300) has to be *ground the road can climb into*. Crater Lake's
  first draft put the lake across the full width and the road ran out across the water —
  the same failure as Miami's rails in the ocean. The fix is one of two moves: go
  asymmetric so land occupies the centre (Crater Lake — the caldera opens left, the rim
  climbs right and carries the road), or put the hero ABOVE eye level so the road passes
  underneath it (Horseshoe Curve — the line runs round the bowl at constant height, which
  reads as a long sagging arch with the valley floor and the road beneath).
- **A horse is 100 units tall and everything reads off that.** Belly at −56, so the legs
  are more than half the animal; barrel 78 long and only 42 deep; head about 28 — a bit
  over a quarter of the body. The first attempt had short legs and a deep barrel and came
  out as a camel. Black points (mane, tail, lower legs) on a bay are most of what makes the
  silhouette read as a horse rather than a brown shape.
- **A foal is not a scaled-down horse.** Legs almost full length, short shallow barrel, head
  a size too big. Scale a horse down and you get a pony.
- **Fences curve.** White four-board plank fence following the roll of the ground is the
  signature of the Bluegrass; drawn straight and level it is just a paddock rail. Posts
  spaced and sized by depth make the line recede.
- **Warm the rock or the blue dies.** Crater Lake's caldera wall is grey-TAN. Drawn neutral
  grey the whole picture goes cold and the water stops singing.
- **Height above eye level is a resource.** Nothing else in the set had used it. Horseshoe
  Curve exists because the line is 200 m above the valley floor, and that is the only
  reason the scene has room for both a half-mile of train and a level crossing.

### New in the shared furniture: the road can turn

`road()` now takes a **`top`** parameter that truncates the carriageway at a given y instead
of running it to the horizon. Everything below that line — the crossing, both gates, and the
corridor the checker tests — is byte-for-byte unchanged, so `top=300` reproduces exactly
what the furniture always emitted and the other twenty-six scenes are untouched. A scene
that truncates draws where the road goes next in its own `scenery-back` layer, which is
painted immediately before the road.

This unlocks a composition the set could not previously hold. Until now, anything at the
vanishing point (634, 300) had to be ground the road could climb into, which is why water
kept getting shoved to one side. Crater Lake now stops the carriageway at the shore and
swings it RIGHT along Rim Drive, which frees the entire width of the picture for the lake —
mountains across the top, water across the middle with Wizard Island centred in it, rim
underfoot. That is how the place actually presents itself, and it is what Rim Drive actually
does.

Two things to get right when drawing a turn:

- **The far gate sits at y=388**, so the carriageway cannot be truncated above about y=376
  or the gate ends up standing off the end of the road.
- **Draw a junction, not a swept curve.** The first attempt bent the carriageway round in
  one continuous arc. Roads do not do that, and it showed: the width drifted the whole way
  along and the shading banded. What works is two roads meeting — the cross road runs at a
  CONSTANT depth, which means constant height on the canvas and one flat colour end to end,
  and cars turn onto it and then go straight.
- **Give the stub a reason to end.** A road that just stops at water is unexplained. Crater
  Lake's carries on past the junction a few metres to an **overlook**: an apron, a timber
  barrier across the end, and people leaning on it looking at the view. That is what a road
  to a lake is actually for.
- **Keep the shoreline ABOVE the road's end.** Water ends at `SHORE`, the carriageway ends
  at `ROADTOP`, and `SHORE < ROADTOP` — the gap between them is the strip of land the
  barrier and the people stand on. Set them equal, as the first draft did, and the barrier
  and everybody admiring the view are floating in the lake.

### Two roads meeting is not two roads touching

The shared `road()` draws a pale verge down each side. Where Rim Drive ran into it the
result was tarmac, then a strip of verge, then tarmac again — which is not how a junction
looks. `road()` now takes **`junction=(y0, y1)`**, which opens the right-hand verge between
those heights and paves the gap, so the two carriageways meet surface to surface with a
radius above and below. The side road's own verge and guard rail have to stop short of the
junction too, or the same seam reappears from the other direction.

Like `top=`, it is opt-in: with `junction=None` the furniture emits exactly what it always
did, verified by diffing an untouched scene's render.

### Uniform noise at a uniform interval is a repeating pattern

Crater Lake's caldera wall was built by sampling a random height every fixed step and
filling down to the water, with evenly spaced vertical stripes for shading. It came out as
a row of near-identical trapezoids with corrugated-card ruling on them, and no amount of
recolouring helped — because random-but-regular is still regular.

What fixed it was generating the crest from **named landforms** instead: a sharp peak, a
long flat-topped mesa, a broad worn dome, a deep saddle — each chosen at random AND given
its own span, so neither the shape nor the rhythm repeats. Crater Lake's rim is mostly
mesa and dome with the occasional peak; getting those proportions right is the difference
between a caldera and the Alps.

Then shade the wall off **its own profile**, not with ruled stripes: every face is a
quadrilateral dropped from one crest segment, lit if that segment rises to the right and
shadowed if it falls, so the shading follows the mountain instead of sitting on top of it.

Two things about that shading had to be got right, and both were wrong first time:

- **Carry the faces only part of the way down, and softly.** Run at full strength from
  crest to water they become alternating slabs of flat colour — that is colour-blocking,
  not shading. Light falls on the tops and dies out as the face drops into the valley's
  shadow, so each face is drawn in two decreasing steps and stops around two-thirds down,
  over one soft band of shadow across the whole foot that seats the wall in the water.
- **Scree is a wash on the lower face, not a bright triangle from the summit.** Drawn full
  height at strength the fans read as pale tents pitched against the mountain. They start
  below the crest, widen to the base, and sit at about 0.2 opacity. Same for the gullies:
  short, soft, upper half only.

Snow goes only in the high hollows, and the wall meets the water in a dark timbered skirt
with an irregular top edge — a straight line there reads as a painted flat.

**Don't stack ranks, and don't use haze at all.**

Two mistakes, and the second one existed to paper over the first.

Crater Lake's rim is **one wall**. In the photograph it is a single continuous band of dark
blue-grey rock sitting low under a great deal of sky. I drew three ranks receding into the
distance, which turned it into a generic mountain range — and then reached for atmospheric
haze to separate the ranks I should not have drawn. The haze made it worse: each rank had a
pale translucent wash over it and the faces on top were low-alpha, so the mountains went
semi-transparent. You could see one ridge *through* another and the whole wall looked like
it was dissolving.

The fix was to delete two of the ranks and all of the transparency. One wall in one solid
colour, with a single lower shoulder behind one end for the depth the photograph actually
shows. Everything painted at full opacity.

Where recession genuinely is needed, **distance is a colour, not a transparency**: mix the
palette toward the sky before drawing, and keep the shapes solid. Alpha belongs to things
that really are translucent — the Smokies' fog, haze over water. Never to rock.

Watch for this pattern generally: reaching for a translucent overlay is often a sign the
underlying composition has too many layers in it.

**Wizard Island is asymmetric, and that asymmetry IS the recognition.** It is not a rounded
green dome. It is a blunt cinder cone with a notch — its own small crater — bitten out of
the summit, sitting on a long, low, bare lava apron that runs away to one side, far wider
and much flatter than the cone. The left flank is steeper than the right, trees crowd the
lower slopes and thin out toward bare grey scree at the top. Draw it symmetrical and it
becomes an anonymous wooded hump in a lake.

**Give it the frame it deserves.** The rim is the top third of the picture, as it is in the
photograph. Drawn low and polite it reads as hills behind a lake rather than as the inside
of a volcano.

This is the same failure as the rocks below, one scale up, and the same cure.

### Rock has to be generated, not drawn

Three attempts at Crater Lake's rim rocks failed the same way, and hand-drawing more
variants did not help. What was wrong was the method.

A hand-drawn rock has six or seven vertices, and no amount of recolouring stops six vertices
reading as a geometric shape. Rock in the photographs has a **many-faceted** silhouette — a
dozen or more small breaks, none of them regular — and a surface broken into flat planes
catching the light at different angles, with cracks running back into the mass. So `rock()`
now generates it: sixteen outline vertices on a half-ellipse, each displaced by a seeded
amount, a flat base because rock sits on the ground, then internal facets cut from the
outline and a few cracks. `lean` skews it so no two sit the same way up.

**Shade a small rock as a solid, not as a cliff.** The first version reused the caldera
wall's scheme — split the shape either side of an interior spine, light one half, darken the
other, scatter facets over it. At twenty-five pixels across that describes nothing; it reads
as a folded piece of paper. A small rock needs exactly three things: **height** (never
flatter than about three-quarters as tall as it is wide, or it is a shard lying on the
ground rather than a lump sitting on it), **light on top**, and **shadow underneath**. The
irregular outline does all the work of looking like stone; the shading only has to say
"solid, lit from above".

Close both bands on a horizontal **chord**, taking only the vertices above or below a cut.
Scaling the whole silhouette instead wraps the highlight round the sides and down to the
ground, and the rock ends up with a pale halo drawn round its outline.

And the highlight has to be clearly lighter than the ground the rock sits on — at the
reference photograph's own values the tops dissolved straight into the pumice.

Three more things had to be tuned before the silhouette stopped looking wrong:

- **Clamp the vertices, and smooth each against its neighbour.** Unclamped, two adjacent
  vertices land at opposite extremes and produce a thin spike. A field of those reads as
  torn paper. Rock breaks into blocks, not slivers.
- **Keep the facets and cracks quiet.** At 0.55 opacity the internal faces read as shattered
  glass. 0.28 reads as stone.
- **Separate the rock from the ground it sits on.** The pale rocks were drawn at the
  photograph's own value, which is almost exactly the pumice around them — so only the facet
  edges showed and the whole thing looked like crumpled paper. Darkening the palette a step
  below the ground fixed it. A photograph can afford values that close together; flat
  vector art cannot.

Two palettes, taken off the reference: pale weathered stacks the colour of the pumice, and
near-black masses of broken lava. Using one grey for everything was the other half of the
problem.

### If it moves, it must not cross anything

Horseshoe Curve ran the carriageway to the horizon, so the road was painted straight over
the railway at the apex — no bridge, no underpass, nothing. As a still picture it was easy
to miss. The moment you ask what happens when the background train is animated, it becomes
obvious: the train drives through the traffic.

The fix was not a bridge. It was to notice that the real road **ends** — Kittanning Point
Road stops at the visitor car park at the foot of the curve and goes no further. So the
carriageway now truncates at `top=376` into a marked car park, with a funicular climbing
from it to the line above. Nothing crosses, so nothing can collide, and the scene got a
better answer to "how do people get up there" as a bonus.

Worth generalising: **anything the engine might animate has to be checked against every
other moving thing in the scene, not just against the static art.** A grade crossing that
looks fine frozen is still a grade crossing.

### A process lesson, learned expensively

`str.index()` finds the FIRST match. Splicing a scene by searching for a marker that appears
in several scenes silently cut out four whole scenes between the wrong pair of anchors. When
editing this file programmatically, always `assert s.count(anchor) == 1` before replacing,
and prefer a unique anchor inside the target function.

### A treeline is an altitude, not a slope

Mount Washington's first pass drew the forest as a band following the mountainside down
each flank. It looked like a hedge laid over the hill. A treeline marks the height above
sea level where trees stop growing, so on a cone seen from the side it is a **horizontal
line straight across the picture**, and the mountain simply widens beneath it. One constant
(`TREE = 246`) fixed the whole thing.

The same scene needed `clip-path` on everything drawn on the face — scattered granite and
gullies generated across a bounding box happily spill past the silhouette and end up
floating in the sky. Clip to the mountain path and the problem disappears for good.

### Some things flat illustration cannot draw, and cloud is one of them

Cloud on the mountain was attempted three times: rafts lying along the base, a heaped bank
against the flanks, and a torn veil across the upper cone. All three read identically —
pale ovals stuck onto the face, like spilt milk. Vapour is sold by a soft edge, and flat
vector art has no soft edge to sell it with; alpha just makes the mountain look
see-through, which is the failure the Crater Lake rim already taught us to avoid.

Snow went the same way: as slabs it read as torn paper, tapered it read as white flags,
rounded it read as sheep. Both were **deleted**, and the scene is better for it. When a
detail has failed three visually different attempts, the honest answer is usually that the
medium can't carry it — not that the fourth attempt will work.

### An amusement park is not made of steel

The obvious way to draw Cedar Point is a tangle of track, and it looks like a scrapyard.
The reference photographs are full of **green**: mature trees between every ride, planters
down the middle of the midway, a belt of woodland the coasters stand in. The scene ended up
with more trees and shrubs than rides, and only then did it read as a place people go.

Two mechanical notes from it. Structure is most of a coaster — drawn as a bare line a ride
is a bent wire, so every track profile gets columns and cross-bracing dropped to the ground
underneath it. And the **lift hill must stay straight**: run through the same cosine
smoothing as the camelbacks it becomes a symmetrical dome and the skyline turns into a row
of mountains. One straight line is the difference between a coaster and a hill.

### Watch what the ground layer paints over

Cedar Point's belt of park trees vanished on the first render. They were in the `far` layer
with their bases at y≈370, and `ground` paints an opaque rect from y=330 downward — so they
were simply buried. Anything in `far` or `mid` has to stand **above** the top edge of the
ground rect, or it belongs in `scenery-back` instead. Within a layer, order still matters
for the same reason: the planting belt had to move ahead of the food stands, or shrubs sit
on their roofs.

### When the hero is a tree, draw the tree properly

Savannah's live oaks were a lollipop on the first attempt — straight trunk, round head —
and the city evaporated. What makes a live oak is that the **limbs leave the trunk low and
run sideways further than the tree is tall**, sagging as they go. Two or three big limbs
beat a dozen small ones, because the silhouette is doing all the work.

The Spanish moss took three passes. Evenly spaced vertical threads read as **rain**, or
icicles. What fixed it was a soft mass at the top of each clump that frays into strands,
strands with a *double* bend rather than a plumb drop, varied length and low opacity. It
also had to be dialled back by half on the midground trees — at that size a full fringe
smothers the crown and they stop reading as trees at all.

An overhead canopy was tried and then **cut**. An arch of limbs across the top of the
frame, in `foreground`, put the viewer under a tree — but at full size it curtained the
skyline, and even lifted clear of the rooftops it read as a decoration pasted over the
picture. Every other scene in the set looks *at* its subject; this one was looking through
a frame nothing else has. The oaks standing in the square carry the character on their own.

The general lesson: a device that only exists in one scene has to earn its place against
the whole set, not just against the photograph.

### A placement registry, not a good eye

Stonington was built by eye and it showed: houses standing inside one another, a fish house
growing out of a roof, trap stacks overlapping crates. `check-scenes.py` passed all of it,
because it only tests a prop's anchor point against the road.

The scene now has a **placement registry**. Every object calls `slot(name, x0, y0, x1, y1)`
before it is drawn; the function raises if the rectangle intersects anything already placed,
or strays onto the carriageway. The failure messages name both objects and print both
rectangles, so fixing a crowded layout is a short loop rather than a hunt.

Two refinements worth keeping. Background items that are *meant* to be occluded — the
spruce behind the village — are deliberately left unregistered, because they are painted
first and a house standing in front of one simply hides it; registering them would force
gaps the real place doesn't have. And when hand-nudging stops converging, write a throwaway
solver that scans candidate positions against the same `slot` logic and prints the
coordinates to paste back in. That took a wharf from ten failed nudges to one pass.

### Draw the object, not the silhouette of the object

Stonington's lobster buoys were a tapered box with a stripe across it, and at scene size
they read unmistakably as **paper cups on a rail**. A real pot buoy is a slim spindle:
rounded at the head, widest about a third of the way down, drawn out to a long point at the
foot, with a wooden stick through the top and two or three painted bands. Getting that
profile right is the difference between "coloured shapes" and "a thing a fisherman owns".

Two related fixes in the same pass. The shop's name board was hung above the ridge, so the
roof covered most of it and what showed read as a stray white rectangle floating behind the
building — it belongs on the wall, under the eaves, with clapboard visible around it. And
the parked cars at the end of the road were drawn in `scenery-back`, which is painted
BEFORE the road, so five of seven were simply covered in tarmac; the car park now skips any
bay that falls under the carriageway.

### If the place is a town, draw a town

Three passes at Stonington all had the same fault, and it was compositional rather than
detailed: open water across the middle of the picture with a green lawn either side and a
handful of houses on it. That is a cove. Stonington is a **town wrapped round a harbour** —
in every photograph the far side is a solid mass of buildings stacked three and four deep
up the granite right down to the waterline, with spruce woods closing the top and timber
piers projecting off every second building.

What fixed it:

- the far shore became **three ranks of houses across the full width**, drawn back to front;
- the water shrank from an ocean to a **harbour basin** — a band, not half the picture;
- **piers**: board decks on pilings running out into the basin with floats and skiffs tied
  alongside. Without them a shoreline is a line, and the scene reads as a beach.

Two mechanical lessons came out of it. `slot()` gained **collision groups**, because a
stacked hillside is *supposed* to overlap between ranks — that occlusion is the whole look
— while nothing at the same depth may touch; each rank is its own group. And a rank laid
out on an exact grid reads as a housing estate, so position, size and colour are all
jittered from one random stream, and the loop steps past each house's true footprint
(including its ell) rather than by a fixed pitch.

When the harbour band moved, three of the five boats stayed at their old heights and ended
up moored among the houses. Anything positioned relative to a horizon has to move with it.

### Cohesion comes from arrangement, not from colour

The first Stonington painted every house a different colour, which is a **seaside resort**.
A working village is one family of buildings: the same steep roof pitch, the same white and
grey clapboard with dark shingle, the same window rhythm, varying only in size and in
whether they have the small wing on one end. The colour belongs to the gear on the wharf —
the traps, the buoys, the oilskins — and it reads far louder for being the only colour
there.

Same principle on the wharf itself. Real stock is stacked *square*: traps in aligned columns
on pallets with walking room between the piles, crates squared up in blocks. Scattered at
random offsets it looks like a spill, not like a business.

### Standing room: things need ground to stand on

Stonington's village was placed straight onto the harbour on the first render — the same
class of error as Miami's rails in the ocean and Crater Lake's road running into the water.
The fix was to give the scene two **headlands**, shoulders of land coming forward out of
the picture on either side, with the harbour opening between them. That also solved the
road: it now runs down between them and stops at the town landing, which is what the real
Main Street does.

The follow-up was more interesting. Fish houses stand on pilings **over the tide**, so the
next attempt gave each one a pool of water to stand in — up on the headland, which read as
a row of garden ponds. In a scene where water is *above* the horizon and land is *below*
it, a building cannot be over water and in front of the water at once. The honest
arrangement is the one the landing already used: put the deck at the waterline and let the
poles go down into the rockweed at the edge of the ledge.

### `scenery-front` is in front of the TRAIN

Savannah's first version put two full live oaks in `scenery-front`, trunks in the
foreground and crowns spreading at around y 400-520. That layer is painted *after* the
train, so the engine drove behind a hedge for half the width of the picture — in a game
for three-year-olds whose entire job is watching the train.

The rule is now explicit: **nothing in `scenery-front` may sit across the track band
(y 450-516).** Foreground trees are drawn as trunks only, hard against the frame edges,
with their leaves belonging to the overhead canopy in `foreground`. A narrow trunk at the
very edge reads as depth and hides almost nothing.

Worth checking on any scene with tall foreground planting, not just this one.

### Give every building its own specification

Twice now a street front has been generated by alternating two house types down a row, and
both times it read as a housing estate rather than a town. The fix is boring and it works:
pass every building its own width, height, storey count, colour, roof type and whether it
has a shopfront. Savannah's row is seventeen buildings and no two are the same.

Height variation matters most — real street fronts **step up and down** against each other,
and two or three towers standing well behind stop the skyline reading as a single wall.

### A road that ends must end at something, and it must be the right colour

Truncating Savannah's street with `top=352` left a wedge of bare sky at the vanishing
point, which read as a hole punched in the town. A row of smaller, lower buildings set
further back turned the hole into distance. Related: the landmark had been placed dead on
the road's axis, so the street appeared to run straight into a church and stop — moving it
off-axis fixed that without moving anything else.

And the streets round the squares are **grey stone**. Painted brick-red to match the
buildings, the road read as a garden path.

### `scenery-front` is in front of the TRAIN

Savannah's first version put two full live oaks in `scenery-front`, trunks in the foreground
and crowns spreading at around y 400-520. That layer is painted *after* the train, so the
engine drove behind a hedge for half the width of the picture — in a game whose entire job
is watching the train. They also walled off the view of the town.

The rule is now explicit: **nothing tall goes in `scenery-front`.** Trees live behind the
rails; the canopy in `foreground` does the framing overhead, where it crosses nothing.

### The checker tests a POINT; canopies are not points

A live oak whose trunk stands beside the carriageway spreads eleven metres of branch across
it, and `check-scenes.py` — which only tests a prop's anchor — passes it happily. Savannah
now defines a local `clear(x, y, half)` that computes the road span at that height and
**raises** if a wide prop overlaps. Every tree and bed is placed through it, so the
generator refuses to build a scene with a tree in the road.

Worth copying into any scene with big planting.

### Don't restyle shared furniture

The road was recoloured twice here — brick red to match the paving, then grey with the
centre line switched off — and both times it stopped matching every other scene in the
game. The furniture is shared *precisely* so it can't drift. The only thing a scene should
change is where the carriageway ends.

### Give every building its own specification

Twice now a street front has been generated by alternating two house types down a row, and
both times it read as a housing estate rather than a town. The fix is boring and it works:
pass every building its own width, height, storey count, colour, roof type and whether it
has a shopfront. Savannah's row is seventeen buildings and no two are the same. Height
variation matters most — real street fronts step up and down against each other, and a
couple of towers standing well behind stop the skyline reading as one wall.

Landmarks earn their place by being nameable: City Hall's **gold dome**, the white church
with its **green copper spire**, and the cable-stayed **bridge** far out on the horizon —
all three set well off the road's axis, because a landmark on the axis makes the street look
like it runs into a wall and stops.

### The splice rule, again, and it cost a scene

`str.index()` finds the FIRST match, and a slice between two anchors deletes everything
between them. Editing this file with an end-anchor that also appears in an *earlier* scene
silently removed the whole of one scene and the tail of another. Both anchors must be
unique — `assert s.count(anchor) == 1` on **each end**, and assert `a < b`.

Scenes are authored **interactively with a human in the loop** (see `DESIGN.md` §3) — reviewed by eye and iterated, not generated unattended.
