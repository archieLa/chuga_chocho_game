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
| Albuquerque | NM | ✅ The mass ascension: ninety balloons over the Rio Grande, the Sandia wall behind |
| Cape Hatteras | NC | ✅ The striped tower behind the dune line, sea oats, the Atlantic beyond |
| Quechee | VT | ✅ The mill on the dam, the falls, the covered bridge, a hillside in October |
| Detroit | MI | ✅ The assembly plant, a lot full of new cars, auto-racks on the siding |
| Sun Valley | ID | ✅ Bald Mountain under snow, the gondola climbing it, Ketchum ploughed out below |
| Indianapolis | IN | ✅ The main straight from the outside lawn: the pit lane, the Pagoda, the bricks |
| New River Gorge | WV | ✅ The canyon floor at Fayette Station, the steel arch 876ft overhead |
| Mount Rushmore | SD | ✅ The carving above Keystone, and the 1880 Train's line |
| Vicksburg | MS | ✅ A towboat pushing fifteen barges, the bluff, the floodwall gate |
| Newport | RI | ✅ The harbour under sail, the Pell Bridge, the wharves and Thames Street |

**Forty-one built.** Forty are generated by `tools/gen-scenes.py`, which owns the shared
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

### Name the place, or it is just an event in a field

The first Albuquerque had the mountains, the balloons and the river and still could have
been anywhere: it read as "some houses, some trees and balloons". What was missing was the
**city** — in every photograph a very wide, very low carpet of flat-roofed tan buildings
fills the valley at the foot of the Sandias, with a small cluster of downtown mid-rises
poking out of it. That band is the thing that says Albuquerque, and it costs one layer.

The other half was **organisation**. A launch field is a laid-out event on marked ground:
white peaked tents along the back, chase vehicles drawn up behind the pitches, balloons on
a regular grid, the crowd strung along a lane in front. Scattered at random it reads as open
country that happens to have balloons over it.

And fewer balloons is better. Ninety at small sizes is confetti; forty at a real size range
still says *festival* and each one is big enough to see that it is sewn from panels.

### A depth rule is not enough: every prop needs its own factor

Scaling a van and a person by the same `near(y)` produced a man two heads taller than the
vehicle beside him and taller than the door of the house behind him. Depth sets *how far
away* a thing is; it does not set *how big the thing is*. So `near(y)` now returns a
**person height**, and each prop carries its own multiplier worked out from the units it is
actually drawn in — a person is 55 units tall at scale 1, a van 26, a two-storey adobe 175.
Real-world sizes do the rest: a person is ~1.7m, a van ~2m tall and ~5m long, a house ~7m,
a hot-air balloon ~20m.

That last figure is why a balloon standing on the field has to be **enormous** next to the
crowd — about twelve times a person — and why three big ones say "launch field" far better
than seven small ones.

The subtle version of the same bug: a figure drawn *inside* another object's transform
inherits its scale. The crew member beside each balloon grew with the balloon, ending up
three times the height of the spectators behind. Anything nested like that has to divide
the parent scale back out.

### Empty ground is not ground

The near band of Albuquerque was 190 pixels deep and 1280 wide with four small bushes in
it, and it read as a car park — the houses sat *on* it rather than *in* it. Ground becomes a
place when it has **routes across it and things growing out of it**: dirt tracks worn from
the road to each door, a coyote fence along the boundary, a parked pickup, yucca among the
chamisa, a doorstep where the wall meets the sand, tyre scuffs.

One layer trap: each track has to stay on its own side of the carriageway. `scenery-front`
is painted after the road, so a track drawn across it is painted over the tarmac.

Related: two copies of the same building, mirrored, still read as one asset. The pueblo
house now has two *plans* — the tall block on the other side, upper storey dropped, a long
low range instead — and only then does the pair stop looking like a stamp.

### One depth rule for the near field, or nothing reads as distance

Albuquerque's foreground had figures at 0.6 scale standing thirty pixels from figures at
1.0, and balloons small enough to be a hundred metres off drawn *in front of* the rails.
That reads as a scale error, not as depth. The layer now sizes everything from a single
`near(y)` rule, and nothing in it is drawn small — if a thing belongs far away, it belongs
in a different layer.

The same rule caps how tall a foreground building may be: `scenery-front` is painted in
front of the train, so the pueblo house is sized precisely so its roofline stops just short
of the track band.

### Scale the landmark to the reference, and colour it to the ground

Two corrections that came straight from a photograph of the real skyline. The Sandias are
**enormous** — from the valley they are a wall a mile high that dwarfs the downtown towers
completely — and drawn as a modest band behind the town they stop being the reason anyone
looks east. They now run from y≈145 to the valley floor, with a paler rank behind so the
range reads as deep as well as tall, and a broad warm apron of piñon-covered lower slopes
under the rock.

And Albuquerque is **brown**. I had drawn it grey-blue, which is what a generic city looks
like; in every photograph the buildings are the colour of the ground they stand on — tan,
terracotta, adobe — with one brick-red tower under a red pyramidal roof that gives the
cluster its silhouette. Colour is identity, and a grey skyline is nobody's.

The mountains had to be made bigger *and* softer at the same time: at that size, faces run
from summit to base become enormous flat wedges and the range turns to origami again. They
now cover only the upper half of each summit.

### A range needs unequal summits, shallow saddles and overlapping spurs

Albuquerque's mountains took five attempts and the failures are worth keeping, because they
were each a different wrong idea:

1. a smooth lumpy crest with translucent triangles — origami;
2. the same, in a tone too close to the sky — no separation at all;
3. evenly spaced summits of similar height — a saw blade, and making the range *bigger*
   only made the repetition louder;
4. deep saddles between the summits — a row of separate triangles, a child's drawing.

What finally worked: hand-authored nodes with **irregular spacing and genuinely unequal
heights**, **saddles that stay high** so the range reads as one continuous wall with
subordinate summits along it, and — the piece that actually creates depth — half a dozen
**overlapping spurs** standing in front of the wall, each broader-topped and warmer than
the rank behind, each crossing its neighbours. A single silhouette stays flat however jagged
it is; overlap is what tells the eye which part is nearer.

A knock-on to watch: the balloon filter clears the front crest, but the paler rank *behind*
rides higher still, so the margin has to clear that instead.

### Mountains are summits and saddles, not bumps

The Sandias took three goes. A smooth crest with translucent triangles laid over it reads as
origami; drawn in a tone close to the sky it barely separates from it at all. What works is
the construction the earlier mountain scenes already used: alternating **summits and
saddles** joined by flanks that are broken into small steps, then a **lit west face and a
shadowed east face cut along each summit's own ridge lines** — not arbitrary triangles
dropped on top — with ravines dropping out of the saddles and a darker rank of foothills in
front. And the range must be darker and cooler than the sky behind it, because that
separation is what says "mountain" before any detail is legible.

### When the sky is the subject, the size range has to be brutal

Albuquerque's first sky had ninety balloons at nearly one size on a nearly even grid, and
it read as **wallpaper**. In the photographs a near balloon covers twenty times the area of
a far one, and it is that spread — not the count — that makes the sky deep. The rows now run
from 0.20 to 1.35 scale with heavy jitter in position and size.

The bigger fix was structural: the sky layer is painted *before* the mountains, so a low
balloon put there is hidden behind the range. The three biggest balloons live in
`scenery-back` instead, in front of the Sandias and above the field. Without something that
close, everything reads as the same distance away.

And nothing should be drawn half-buried in the scenery: the sky layer now **filters out
any balloon whose envelope would be cut by the ridge**, computing the crest height at that
x. A balloon sliced by a mountain reads as a mistake, and the big low ones live in
`scenery-back` in front of the range anyway.

Two other lessons from it. **A mountain that is a wall must be drawn as a wall** — the
Sandias run the full width with a level crest and a steep face, and drawn as a triangle they
become any mountain anywhere. And **a balloon on the ground is worth drawing upright**: two
attempts at a half-inflated envelope lying on its side read as a leaf or a shell, and
standing-and-inflated is equally true of a launch field and instantly recognisable.

### A spiral is not a diagonal stripe

Cape Hatteras is defined by its stripe, and a helix seen side-on does not project to a
straight band — it **bows**. Each black band is drawn as a bowed slanted quad clipped to
the tower silhouette, with the slant and bow decreasing up the taper. Straight diagonals
give you a barber's pole, which is a different object.

The other half of it is the **red-brown octagonal plinth**. It is the only colour on the
whole building, and without it the tower could be any striped lighthouse anywhere.

Also worth generalising from that scene: **the dune only reads as a wall if it is a
different tone from the sand either side** — a pale sunlit crest with a band of shadow at
its foot. Drawn in the same colour as the beach it disappears entirely, which is what the
first render did.

### Autumn is a mass of individual crowns

Quechee's hillside is the first autumn in the set, and the thing that makes it read is that
it is **hundreds of separate crowns in mixed colours**, not a green shape tinted orange.
Sampling a fifteen-colour palette — roughly half red-orange, a quarter yellow, a quarter
still green or dark conifer — gives a slope you can almost pick single trees out of. Three
tidy colours in bands gives you a carpet.

The three ranks recede by **washing the whole palette toward the sky colour**, never by
opacity. Same rule as every other distance in the set.

### Water going over an edge has three parts

The first falls were a white block with evenly spaced white streaks, and they read as a
**picket fence**. Water coming over a dam needs all three of: a smooth glassy lip still the
colour of the river, a broken middle where it goes white in streaks of *uneven* width and
length, and a mass of foam where it lands — plus one hard bright line along the lip, which
is what says "edge".

It also needs somewhere to come *off*. Floating between two stretches of grass it was a
waterfall in a meadow; a stone abutment at one end and the mill's footing at the other
fixed it. Same principle as a road that has to stop at something.

### Watch for bare canvas between two bands

Quechee's near bank started below the pool, but the millpond ended well above it — leaving a
band of **pure white canvas** straight across the picture. It is invisible in the code and
obvious in the render, and it is the reason to look at the PNG rather than trust the
geometry.

### The colour comes from the stock

Detroit is a grey shed and a grey apron, and it works because the shipping lot in front of
it holds hundreds of new cars in tight rows. Exactly the same trick as Cedar Point, where
the colour is in the rides rather than the buildings — and the same rule in reverse for the
plant itself, which is white because a real one is.

An industrial site also has more green than a plan suggests: grass verges and volunteer
trees along every fence line. Without them it reads as a car park with a shed behind it.

Scenes are authored **interactively with a human in the loop** (see `DESIGN.md` §3) — reviewed by eye and iterated, not generated unattended.

### Snow is a colour problem, not a texture problem

The first winter scene in the set was Sun Valley, and almost everything that went wrong on
the first pass was a contrast failure rather than a drawing failure. White snow spray in
front of white snow is invisible. A chalk-white aspen trunk on a white field is invisible.
A white snow berm along a white verge is invisible. Every one of them had to be given a
pale blue edge — `#c3d8ee` against `#f4f9fe` — before it existed at all.

The corollary is that **snow shadow is blue, never grey.** Grey shadow on white reads as
dirt. Everything shaded here is a step toward `#aec5e2`, and the picture holds together
because of it.

### A whaleback needs points close together over the summit

Idaho's ranges are big rounded masses worn smooth, and the first attempt drew them as a
polyline between summits, which is a row of triangles. The fix has two halves and both
matter:

1. **Smooth the crest.** Each summit becomes a quadratic control point and the curve passes
   through the *midpoints* between them (`crest_path`), so tops come out domed and saddles
   come out as shallow bowls.
2. **Put several points inside a hundred pixels at the top.** Smoothing three widely spaced
   points still gives a cone, because there is nothing to round off. Bald Mountain's summit
   is four points inside 100px and only then does it read as a dome with shoulders.

And the light has to agree: a crisp lit/shade split running to a single apex will make a
perfectly rounded mountain read as a pyramid anyway. The two flanks here are separated by a
broad soft band, not a line.

### Forest on a mountain face is thousands of trees, not a shape

Painted as tapered wedges from crest to valley, the timber on a ski mountain comes out as
enormous dark spikes. It is the same lesson as the autumn hillside at Quechee: scatter
individual little trees from just below the crest down to the valley floor and let the ski
runs be **the gaps the timber leaves**, which is exactly how runs are actually cut.

### Get the depth order right before drawing anything

The Speedway was drawn twice. The first version put the pit lane in front of the racing
surface — which only happens if you are standing in the infield, and then the Pagoda, which
is on the infield side, would be behind your head. The whole scene had to be re-stacked:

> grandstand across the way · Pagoda · garages · pit lane · pit wall · track · catch fence ·
> the grass we are standing on

Deciding *where the viewer is standing* is the first move in a scene like this, not
something to settle once the parts are drawn.

### A crowd is pale with colour through it

Fifty thousand people rendered as bright dots reads as confetti. The palette has to be
mostly skin, shirt and hat — pale neutrals — with saturated colour scattered a few percent
through it. And they must sit in **rows**: jitter within a row, not free scatter, or the
grandstand stops reading as raked seating.

### Fences must be suggested

Catch fencing at full strength turns into a cage over the whole picture and everything
behind it goes grey. It needs to be there — a bit of tarmac without it is just a road — but
at about a fifth of the opacity a camera would give it.

### A road has to end somewhere that makes sense, not just somewhere

The rule in this guide has always been that a road must end at *something*. The Speedway
showed that is not sufficient: the first version ended it at a gate in the perimeter fence,
which is a real object, and the scene still made no sense — a gate onto what? The road only
works once it is the **track access road**, with the apron carrying on through the opening
onto the tarmac, a marshal at the gate, and race cars queueing on the grass to use it.

The test is not "does the road stop at an object" but "can a child say where the cars on
this road are going".

And the vehicles beside it have to obey the same depth rule as the people: the first pass
put ordinary spectator cars on that grass and they came out smaller than the spectators
standing next to them.

### A lift is a loop, so both ends are buildings

The first Sun Valley pass drew both haul ropes as lines that simply stopped in mid-air at
the top. Nothing else in the scene was as obviously wrong. Every aerial lift has a terminal
at each end with a bullwheel in it, and the rope has to stop a few pixels *short* of the
terminal so a cabin at either extreme is inside the building rather than dangling off the
end of a wire.

Related: those terminals were first drawn behind the town, which put the base stations
behind a rooftop and made the ropes appear to vanish into a chimney. Lift bases stand at the
edge of a ski town — draw them in front of it.

### Traffic should be traffic

A row of parked cars is scenery; cars on a road ought to be able to move. The Ketchum cross
street now carries side-on vehicles with their own ids, plus the three paths an engine needs
to bring a car up the main road, **turn it at the junction** and send it along the street —
authored to meet at one shared point so there is no seam.

### Decide what moves before you decide what to draw

The Sun Valley mountain originally carried a piste groomer. It looked plausible standing
still and was wrong the moment anything moved: it sat among the trees rather than on a run,
and its only sensible animation path went straight through the skiers. It came out, and the
mountain now carries only skiers — each on an exported run path that wanders inside its
corridor so a walked figure comes down in a line of turns rather than a ruled fall line.

The general form of the lesson: **a prop that will be animated has to be placed against its
own path, not against the composition.** Two moving things sharing a slope need either
separate paths or a reason not to collide, and that is a decision to take while drawing,
not afterwards.

Its corollary for the plough: the exported `#plough-path` clears the verge and stops at the
carriageway, so no animated pass can drive across the road or the crossing.

### A lift is a loop, so it has two ropes

Following on from the terminals: the first Sun Valley pass drew one rope with everything on
it travelling the same way. Every gondola and every chairlift is a continuous loop — cabins
climb on one rope and come back down the other, which is exactly why a lift tower carries a
*pair* of sheave assemblies rather than one. Both lifts now draw the rope twice, offset
perpendicular to the line, with the two sets of cabins staggered half a cycle apart so they
pass rather than march in step.

It is a small thing that anyone who has ever been on a chairlift will notice immediately,
which is the useful test for this whole category of error.

### The Rushmore lesson: at 100px, value beats detail

The four faces took four attempts and every failure was the same failure. The first pass
produced Easter Island moai — the skull was too long and narrow, the eyes were wide flat
ovals sitting *on* the surface rather than sunk into it, and the nose was a thin straight
wedge running most of the face. Proportion fixed that: a head is about **1.4 times as tall
as it is wide**, the eyes sit at the **middle** of that height, and the nose ends about
three-quarters of the way down and is wide at the base.

The second and third failures were the opposite mistake — adding detail. A brow band across
the full width became a headband; a highlight layered over the hair became a turban; a cheek
plane became a scar. At a hundred pixels wide, a viewer sees a pale face mass, a dark cap of
hair, two dark sockets, a shadow down one side of the nose and a dark line for the mouth.
Everything past that is noise pretending to be craft.

Identity then comes from a *very* small number of marks: Washington's lapel, Jefferson's
raised chin, Roosevelt's glasses and moustache, Lincoln's beard. Four marks, four people.

### A gorge has to converge

The first New River Gorge pass drew the walls as a flat band across the back and the scene
came out as a lake with a wood behind it. A gorge is two walls climbing steeply out of both
edges of the frame and squeezing the sky into a wedge — and the landmark crosses that wedge.
Without the squeeze there is no gorge, however good the bridge is.

Related, and general: the near ground under those walls is **forest floor**, not a beach.
The first pass left a huge empty tan flat either side of the road and the whole gorge read
as a sandpit.

### Water needs a hue, not just a name

Vicksburg went through three passes of river colour. Muddy brown, honestly rendered, sat at
exactly the same value and hue family as the tan bank and the olive levee, and the
Mississippi read as a mudflat you could walk across. What fixed it was making the water
distinctly **greyer and cooler than every piece of land around it**, then adding the two
things that only water has: a dark reflection of the far bank along its top edge, and a wide
silver sheen band across it.

Newport is the same lesson from the other end — it is the one scene allowed a strong blue,
and after Vicksburg's grey-brown it is a relief.

### Paving goes in `ground`, not `scenery-front`

Newport lost its entire road for a render because the granite quay and the cobbled street
were painted in `scenery-front`, which is drawn *after* the carriageway. Anything that is
ground — paving, aprons, streets, quays — belongs in `ground` or `scenery-back`, before the
road. `scenery-front` is for things that stand in front of the *train*.

Its sibling: the Thames Street terrace ran straight across the carriageway until it was
taught to step over the gap, and the Vicksburg warehouses stood squarely on the rails
because a 76px parapet on a baseline of 556 reaches up into the y=450–516 band.

### One road per scene, and it is the game's road

Vicksburg carried a second carriageway running horizontally across the frame — a levee
street at the foot of the floodwall. It was wrong twice over. Its perspective could not
agree with the game's own road, which is a ribbon receding to a vanishing point, so the two
fought each other; and the engine drives cars along the game's road, so a painted street is
exactly where live traffic is about to appear.

If a scene needs a second road, it has to *be* somewhere the game's road goes — a junction,
a landing, a yard — not a parallel band across the picture.

### A gate must open onto somewhere

"The road ends at something" is not enough if the something is a hole in a wall with nothing
behind it. Vicksburg's floodwall gate only started working once there was a gravel landing
beyond it with a boat ramp running into the river on the road's own axis and pickups parked
on it. The question to ask is not *what does the road stop at* but **where is the car
going**.

### Two trains is nearly free

The dark span at Vicksburg is the railroad bridge, so it carries a freight — exported as its
own group on its own path, independent of the player's train at the crossing. Two trains at
two depths moving at two different speeds is a great deal of life for one extra group, and
any scene with a railway visible in the background can have it.

### The near field has to be a place, not a leftover

Removing Vicksburg's horizontal street was right, but it left the bottom third of the frame
as an undefined gravel expanse — and "not a road" is not an answer to "what is this?". It
had to become a *place*: the grassed levee that runs down from the town to the water, with
mown bands, live oaks, benches facing the river and the warehouses standing back on gravel
pads.

Two rules came out of it. **Buildings sit whole inside the frame** — one sliced by the
canvas edge reads as a mistake, not as a street continuing past it. And **a prop is about
2.8 times as long as it is tall** if it is a road vehicle; the first pickups here were 2.3
and came out as stubby toys, which is the most common way a small prop goes wrong.

### Nothing else may line up with the road's axis

The road vanishes at x=640, and the eye follows it. Anything placed on that axis beyond the
road's end gets read as a continuation of the road. At Vicksburg a boat ramp sat dead ahead
of the carriageway with the barge tow parked on the same line, and the scene read as a road
running down a slipway and onto the barges — a reading nobody intended and everybody had.

The fix is not to make the end-object bigger. It is to move everything else off the axis:
the ramp went right, the tow went left, and the only thing now straight ahead of the road is
the thing that stops it.

Corollary: whatever *does* stop the road must be a clearly different size from the crossing
gate, or the two stack up and read as two gates. Low concrete bollards work; a chevron board
at gate height does not.

### Measure props off the ROAD, because it is the only known dimension

Vicksburg's car park was drawn three times and the vehicles came out at 0.34, then 0.52,
then finally right at 0.98. All three times I sized them by eye against the floodwall — and
the floodwall was itself drawn too short, so every vehicle inherited that error and I kept
"fixing" it by small increments that were still half of what was needed.

The road is the one object in every scene whose real width is known: **7.3m**, and its
apparent width at any y is exactly `road_span(y)`. So:

```
px_per_metre(y) = (road_span(y)[1] - road_span(y)[0]) / 7.3
```

At y=418 that is 12.2 px/m, so a 5.5m pickup is 67px — for a 68-unit drawing, a scale of
0.98. At y=700 it is 34 px/m and the same pickup is 187px. Two lines of arithmetic, and it
replaces an argument.

Do this for anything whose real size is known — vehicles, people, doors, benches, rolling
stock — instead of eyeballing it against another prop that might itself be wrong. **An error
in a reference prop propagates into everything measured against it.**

### Separate by KIND, not just by distance

The barrier at the head of Vicksburg's road went through three versions. A chevron board at
rail height read as a second crossing gate. Moving it further away helped a little. What
actually fixed it was making it a *different kind of object*: the crossing gate's arm is a
red-and-white striped horizontal bar, so the barrier became a plain timber beam with small
reflectors on it. Two striped horizontal bars near each other read as two gates however far
apart you put them.

### `ppm(y)` — the one honest ruler

Every scene should carry this:

```python
def ppm(y):                       # pixels per metre at depth y
    t = (y - HORIZON) / 420.0
    return ((644 + 126*t) - (622 - 112*t)) / 7.3    # the road is 7.3m wide
```

Newport was rewritten from scratch because three separate things in it were wrong by
factors of two and five, and all three were eyeballed. Houses came out at 60px where 310
was right — *shorter than the train*. Sails came out at half size. The Vicksburg car park
went through three passes for the same reason.

Real sizes worth keeping: person 1.7m · car 4.6m long · pickup 5.5m · boxcar 4.4m tall ·
storey 3.4m · three-storey townhouse ~11m to the ridge · sloop mast ≈ 1.35 × hull length.

And the consequence is compositional, not cosmetic. A correctly-sized townhouse at the front
of the frame is 400px tall — it *cannot* go in the middle without hiding the train, so it
becomes a wing at the edge, and the scene turns into a street canyon opening onto a view.
Getting the scale right does not just fix the drawing; it tells you what the picture is.

### The far gate fixes the road's vertical budget

The far crossing gate stands at **y=388** and reaches down to y=445. The road has to exist
underneath it, so `top` must be above 388 — and therefore **everything the road ends at has
to fit between the horizon (300) and 388. Eighty-eight pixels, total.**

That is not enough for a T-junction: a turn needs about 50px of cross street to read, which
leaves 38 for whatever else the scene is about. Newport spent three attempts learning this.
Sun Valley gets away with a cross street only because its road stops at `top=378` and its
mountain lives *above* the horizon rather than below it.

When the road needs to end near the horizon, prefer something that occupies the band
sideways rather than in depth: a **station platform and forecourt** (Newport), a car park
(Vicksburg), a bridge portal (Quechee, the New River Gorge), a gate (Detroit).

### A station is worth having

Newport is the first location where the train can *stop for people*. The platform edge is
exported as `#platform`, with a canopy, benches, a name board and passengers waiting. For a
game about a railway it is strange that it took forty-one destinations, and any scene with
room along the track can have one.

### Check what a bridge actually carries

Three big bridges went into Wave 7 and only one of them is a railway. The New River Gorge
Bridge is US-19 and the Claiborne Pell is RI-138 — both four-lane highways, neither with any
rail on it — while Vicksburg's 1930 truss carries the Kansas City Southern. Putting a train
on the wrong one is the sort of error that a child who likes trains will notice before an
adult does.

The related judgement: at the New River Gorge the railway is *already in the scene* — it is
the line at the bottom of the gorge that our own level crossing sits on. Lowering the arch
to make a train on it read would have traded the one fact everybody knows about that bridge
(876 feet) for a gag. Put traffic on it instead, and let the height stand.

### Four faces in a row is a totem pole

The Rushmore heads took five attempts and the thing that finally worked was visible in one
glance at the reference all along: **they are not all facing forward.** Washington is turned
well to his right so we see him three-quarter with his nose breaking the silhouette; Lincoln
is turned the other way; Jefferson is nearly frontal with his chin up; Roosevelt is recessed
so far that only the glasses and the moustache really read.

That turn is most of the likeness, and it is cheap to draw: scale the half-width either side
of the centre line by the turn, drop the far eye entirely past about 0.5, and let the nose
project past the face's edge. A projecting nose profile is worth more than any amount of
modelling on a frontal face.

Two other corrections worth keeping: carved heads are **long** — about 1.7 times as tall as
wide, not the 1.4 of a portrait head — and there must be **no highlight strip along the top
of the brow**. Three separate attempts put one there and all three read as a headband: a
pale horizontal bar across a face is seen as an object, not as a lit edge. Draw only the
shadow *under* the brow, and stop it well short of the sides of the head.

### A main street runs ALONG the road, not across it

Keystone was first drawn as a band of shops straight across the frame, which reads as a
barricade the road runs into. A main street has buildings down **both sides**, receding with
the carriageway — so they are placed against the road's own edges at decreasing depth and
sized off `ppm(y)`. The same is true of any town scene where the road is the street.

The corollary: the road can then run much further out, because there is nothing standing in
it. Anything at the vanishing point is a thing to walk *toward*.


### The Rushmore faces: what is fixed and what is still wrong

Recorded honestly, because this took six passes and is still not finished.

**Fixed, and it was the real bug:** a sign error. `T < 0` means the head is turned to our
left, so the nose must move LEFT with it and the eye that disappears round the turn is the
LEFT one. The code had the nose shifted right and the *right* eye dropped — so the one
surviving eye sat on the opposite side of the nose from the direction of the turn. That is
why Washington and Lincoln did not read as faces at all: they were anatomically impossible,
not merely stylised.

**Also fixed:** four frontal heads in a row is a totem pole — the turn is most of the
likeness; carved heads are long, about 1.7 : 1; and there must be **no highlight strip along
the brow** (three attempts, three headbands).

**Also fixed, and this was the second real one:** the nose was a separate wedge with its
own outline, so it detached from the face. A nose is **one form growing out of the brow**,
and the way to draw it is to fill it in the *same tone as the face* and separate it from the
cheek using only the shadow down its turned-away side — with that shadow running all the way
up into the eye socket, which is what physically joins a nose to a brow. Give a nose its own
outline and it will always look stuck on.

Three more corrections that came out of the same pass: keep the profile jut modest (a long
one turns beaky), keep the lit ridge on the bridge **narrow** (a wide one is a slab, not a
highlight), and keep the under-nose shadow well clear of the mouth line — the two together
read as a moustache.

**Still open, if this ever gets another pass:** Roosevelt should be pushed further into
shadow so he reads as recessed rather than merely smaller, and the hair wants real structure
— Washington's rolled sides, Lincoln's tousled mass.


### Some things are not a drawing problem, they are a SIZE problem

The Rushmore faces took seven passes and the last one was the only one that mattered: the
carving was drawn 555px wide and shrunk to about 330.

A flat-vector scene has **no gradient with which to model a face.** Every shape that
describes a form therefore has a hard edge — and at 400px a hard edge on a face is read as a
*feature*. That is the whole explanation for six passes of headbands, moustaches, smiles and
second mouths. It was never clumsiness; it was a size the technique cannot support.

At about 330px for the group the faces read the way this style is actually good at: by
**silhouette** — hairline, brow, jaw against the sky — with three or four dark marks inside.
And the scene becomes what it should always have been, *the Black Hills with Rushmore in
them* rather than a portrait with a town underneath.

The general rule, and it is worth reaching for early: **if a subject keeps failing at a
given size, try it smaller before trying it again.** The style has a resolution at which it
is honest, and pushing past it costs more passes than starting over does.

### Check that an edit script actually wrote

A whole round of Keystone fixes silently never happened: the edit script made four correct
replacements, then hit an assertion on a fifth anchor and aborted — **before** the single
`write_text` at the end. The earlier four went with it. I then fixed only the failing anchor
and reported the batch as done, so the user got a render with half their notes unaddressed
and no error to point at.

Two rules from it. **Never report a batch as applied without re-rendering and looking**, and
prefer **one replacement per script** — or write after each — so a later failure cannot
silently discard earlier successes.

### A crest needs an overall SHAPE before it needs texture

The Mount Rushmore skyline was drawn four times and the first three all failed the same
way:

1. a zigzag of evenly spaced alternating points — **shark's teeth**
2. a staircase of level tops — **a bar chart**
3. irregular level tops — **castle battlements**

Each attempt was an attempt to make the *detail* better, and the detail was never the
problem. The problem was that the crest had no underlying mass, so the eye read the
detail as the subject.

The version that worked builds the profile from a **dome** — a Gaussian, high over the
carving, falling away both sides — and then cuts the joint blocks into that dome as small
notches (±26px) with slightly tilted tops and widths varying from 16 to 50px. Shape
first, texture on top of it. This is the same order that finally worked on the Sun Valley
crests and on the Crater Lake rim; write it down once more because it keeps having to be
rediscovered.

### Anything drawn on a mountain must be CLIPPED to the mountain

Fracture lines were drawn from the ground up to a fixed height across the whole width.
Wherever the crest happened to be lower than a line's top, the line carried on into the
open sky and hung there as a grey scratch. Six passes over this scene and nobody saw it
because it was faint.

Build the silhouette path once, put it in a `<clipPath>`, and draw every bit of surface
detail — fractures, pillars, spires, flank shading — inside a group that references it.

### Building detail must scale with the building, not with the canvas

The Keystone shops used fixed pixel sizes: 12px windows, a 17px shopfront, boards every
7px. Near the horizon that is fine. In the near field, where `ppm(y)` makes the same shop
150px wide, the wall grows and the detail does not — so the near shops came out as **bare
barn walls with a scatter of tiny windows**, which is exactly what "these buildings all
look the same and they're boring" means in practice.

Every dimension inside a building generator should be a fraction of that building's own
height: window `0.115w × 0.155h`, spacing `0.26h`, shopfront `0.30h`, boards `0.075h`.
A near shop then gets a proper plate-glass window and a door, which is what actually says
*shop* at that size.

### The smile keeps coming back, and it comes from a different place each time

Running tally of shapes that turned into a grin on a carved face: the cheekbone crescent,
the shadow under the cheekbone (that one was a moustache), the lit chin (that one was a
second mouth), the lit chin *plane* drawn wide, and finally the **throat shadow under the
jaw** — a broad dark curve sitting just below the mouth, which is a smile no matter what
you meant it to be.

The rule that has held: on a face this size, any horizontal curve within about 40px below
the nose will be read as a mouth. Keep it narrow, keep it low, keep it faint.

### A moustache is carved granite, not ink

Roosevelt's moustache was filled `#39342b` — near-black — and the result was instantly a
cartoon villain, the single worst thing that has been on this mountain. Features on a
carved head are filled **one step darker than the cheek and no more**. What makes a
walrus moustache read is the *shape*: wider than the nose, thickest at the centre,
sagging past the corners of the mouth and hiding them — which is also why it needs no
separate mouth line underneath.

Same lesson for the pince-nez: thin rims in a granite tone, lenses left as face tone.
Drawn heavy and dark they were swimming goggles.

### Hair detail: four attempts, and the answer was none

Washington's rolled curls were tried as light/dark ellipse pairs (soap bubbles), then as
curved strokes (a scribble on his temple). Lincoln's tousle was tried as circles (polka
dots), then as strokes. At this size the **silhouette** — hairline, mass, sweep — is the
whole likeness, and every mark added inside it is noise. Draw the shape and stop.

### Hang a beard off the JAW, not off a half-width

Lincoln's beard was built from `-wl`, the left half-width. But Lincoln is turned to our
right, so `wl` is the *back of his skull* — the beard was growing out of the back of his
head. Face features follow `mx` (the turned centre line); only the skull outline follows
`wl`/`wr`.

### Ask every scattered prop whether it is standing in the road

Two ponderosas from a 260-tree horizon band landed either side of the road's vanishing
point and closed the road off — after four rounds of "the road doesn't reach the
mountain". The corridor is only a few pixels wide up there, so it is easy to miss and
easy to hit.

The fix is a one-line predicate held in the scene and applied to every procedural
scatter, not a hand-cull of the two offenders:

```python
def in_road(x, y, pad=16):
    if y < ROAD_TOP - 4:
        return False
    t = (y - HORIZON) / 420.0
    return (622 - 112 * t - pad) < x < (658 + 112 * t + pad)
```

`check-scenes.py` catches props on the *track*; nothing catches props on the road. Until
it does, every `for _ in range(n)` that plants something needs this guard. Savannah had
a tree on the road, twice — same bug, and hand-culling it there is why it came back here.

### A near-field building's height is NOT `ppm(y)` of the frame bottom

Mystic's street wings were sized with `ppm(720)`. At the very bottom of the frame that is
**35.6 px/m**, so a three-storey building came out 380px tall and buried the entire track
band — the train ran behind the scenery, which is the one thing a scene here may never do.

Wings stand at the SIDES of the frame, set back from the viewer, so they take their own
edge scale. Pick it from the constraint, not from the metre: every roof must land below
**y=516**, the bottom of the rails. Check that first and the proportions second.

### A gantry's legs must be open, or it is a concrete pylon

Bailey Yard's service gantry was first drawn with solid tapered legs and it read as a
bridge pier. The whole point of a gantry is that you see sky through it. Two slender
members per leg with X bracing between them and nothing else — the same reason the Mystic
bascule's leaf is an open truss rather than a plate.

### A locomotive at 40px is the STEP, not the shape

Three attempts at a hood unit came out as a bus, then as a flatcar with a yellow container
on it. What reads at that size is the *step*: a long LOW hood (3.2m), a taller cab (5.3m)
set well back, a stub nose — plus a hard dark edge down both sides of the cab. Without
those two edges the cab and hood are the same colour touching each other and the whole
machine flattens into a slab.

Also: radiator louvres drawn wide enough to see are read as *windows*, which is what turned
the first version into a coach. And three locomotives buffered up in a row become one
continuous yellow band; a machine needs ballast either side of it to be a machine.

### Draw the bridge before you draw the river

The Mystic bascule went into `mid`, and the layer order is sky, far, mid, ground, **water**
— so the river painted over its own bridge. It took a moment to spot because the towers
still showed above the waterline. Anything standing IN water goes in `scenery-back`.

### A hinged mechanism is ONE rigid body

A heel-trunnion bascule is not a deck that lifts and a counterweight that falls. The deck
leaf, the arm reaching back over the pin, and both concrete blocks are bolted together and
swing as a single lever. So `#cc-bascule-leaf` carries `translate(pivot)` and **every child
is in pivot-relative coordinates** — opening it is `translate(900,330) rotate(-72)` and
nothing else in the scene moves.

The first version offset the deck by the pivot but not the arm, and the counterweights
ended up in the top-left corner of the sky. If part of a mechanism is in absolute
coordinates and part is relative, the animation will tear.

### Same-width, same-height, same-colour frontage is a picket fence

Mystic's far shore was 23 white houses on one baseline: a fence. Real waterfront varies in
every dimension at once — width, height, roof pitch, baseline — and about one in four is
not white. Trees over the joins break the run. This is the Savannah lesson again, and it
arrives every time a row of buildings is generated from a regular loop.

### A bridge is a road that keeps going

Seven drafts of Mystic failed the same way and I could not see it: the bridge was a machine
sitting in a river. Big, small, centred, off to one side, in profile, three-quarter — none
of it mattered, because the deck started nowhere and ended nowhere. There was no road on the
far bank and our own road did not run onto it.

The test is one sentence: **can you follow the carriageway from under your feet, across the
water, and out of the picture on the other side?** If not, you have drawn a machine, and no
amount of counterweight detail will fix it. Draw the road on the far bank *first* — even a
30px strip going up between the houses — and then the bridge has a job.

### The head-on lift, and why it is two states rather than a transform

Side-on, a bascule opening is one rotation about one pin. Head-on it is not a rotation in
screen space at all: the far edge rises AND the perspective foreshortening unwinds, so the
deck gets *wider* as it comes up. A `rotate()` cannot do that and a `scaleY` about the hinge
keeps the width constant, which loses most of what sells it.

So the leaf is authored twice — every moving shape a quadrilateral, `points` for down and
`data-up` for up, four points to four points — and the engine tweens the points. Nine quads,
about twenty lines of engine code, smooth at 60fps.

Two things learned drawing it: the centre-line dashes have to fade out past about 15° (they
would need to compress non-linearly and nobody misses them once the deck is on end), and the
kerbs must be pale **concrete**, not another grey steel. Drawn a shade off the roadway they
vanish and the raised span comes up as a featureless slab.

### Two barriers in one scene must differ in KIND

Mystic has the crossing gate and the bridge's approach boom. The rule that has held
everywhere else in this set applies here too: a second barrier that differs only in
*position* reads as a duplicate of the first. The crossing keeps crossbucks and red lamps;
the bridge boom is a plain black-and-white pole on a squat pedestal with no lamps at all.

The same reasoning killed the idea of wiring the lift to the gate buttons. Those two buttons
are the one piece of vocabulary the game has taught — *the train is coming*. Make CLOSE
sometimes mean *a boat is coming* and the vocabulary blurs. The bridge runs on its own timer
and merely defers to the gate; nothing the child presses starts or stops it.

### The river-over-bridge bug does not look like a missing bridge

This is the second time in one scene, and the second time is the one worth writing down.

Anything standing in water and drawn in `mid` is painted over by its own river, because the
layer order is sky, far, mid, ground, **water**, scenery-back. I knew that — there is an
entry above saying so — and I put the Mystic bridge back in `mid` anyway.

What made it survive a look: **the failure does not present as a missing bridge.** The
fixed far span sits just above the waterline, so it survives, and the towers are above the
water entirely. The picture still shows a bridge. What is missing is only the half that
crosses the channel — so what you actually see is a road that stops at the quay, a band of
open water, and then a bridge starting inexplicably on the far bank.

Check the **span over the channel**, not the towers. And check it at zoom on the thing you
changed: I signed this off from a 1200px contact sheet where the gap read as a thin dark
line and I told myself it was the deck.

### Two halves of one road meet on the same two x values

The fixed span's near end was 20px wider than the moving leaf's far end, which threw a pale
wing out either side of the carriageway at the joint and read as a ledge laid across the
bridge. Where two pieces of one road meet they share their edge coordinates exactly —
derive both from the same variables rather than writing each from its own offsets.

### A bridge closed is ONE road — build it from one generator

Mystic's moving leaf and its fixed span were built by separate blocks of code, each with its
own width, its own kerb inset and its own idea of where the edge was. Closed, it read as two
slabs of road butted together — which it was.

The deck is now a single taper, `t=0` at the hinge to `t=1` at the far abutment, and every
part of it — underside, girder, roadway, kerbs, parapets, centre line — comes out of the
same `ed(t)`. The leaf is simply the piece with `t < 0.55`; the only difference is that its
pieces carry `data-up`. Kerb and parapet widths are fractions of the local deck width, so
they taper with it instead of stepping at the joint.

The general rule: **when one object is split for animation, generate both halves from the
same function and split by parameter, not by writing each half separately.** Two hand-written
halves will never line up, and the seam is exactly where the eye goes.

### A road does not need a prop to end it

The far-bank road was cut off flat against the sky, so I planted a stand of trees across the
end. That is a stage flat and it looked like one. A road going over a rise **tapers to almost
nothing and is gone** — six pixels wide at the top of the bank does it, and the scattered
trees already on the shore fall naturally either side of it.

### Boats get measured off the road too

Mystic's sloop was drawn at a hand-picked scale factor and came out 4.9m long with a 6.5m
mast — a pond yacht moored next to full-size cars. It read exactly as what it was: a toy.

Every vessel in this set now takes its scale from `ppm(y)` like everything else:
`scale = (length_m × ppm(y)) / (generator's own unit length)`. A Mystic sloop is about 11m
on deck with a mast roughly 1.35× the hull, and getting that right is not decoration — the
mast has to be visibly too tall to pass under the closed span, or the bridge has no reason
to open.

Same failure as the Vicksburg car park, the Newport houses and the Keystone shopfronts. Four
times now. If a thing has a real-world size, look it up and multiply by `ppm(y)`; never pick
a scale factor by eye.

### The height cap on a foreground building is the RAILS, and `h` is not the building

Mystic's street got gables, mansards, cornices and chimneys — and the gable ends went
straight through the ballast, because I sized the WALL and forgot that the silhouette is
taller than the wall. A cornice adds 0.055h, a gable another 0.32h, a chimney sits above
that: a 207px wall is a 285px building.

Nothing in `foreground` may reach above **y=516**, the bottom of the track band, or the
train runs behind the scenery. Size the stack, not the wall, and check the tallest element
of the tallest building.

### A row of buildings needs a row behind it

Where a two-storey shopfront sat beside a three-storey one, the gap above it showed bare
ground standing on end like a wall. A street has depth: what you see over a low roof is
another roof. A cheap back row — plain blocks, a cornice line, two rows of windows, muted
by one step — fixes it completely, and it must break where the carriageway runs through,
because what you see up the street is road.

### In a flat layer, ORDER IS DEPTH — append far to near, always

Bailey Yard's service-road pickups are at y=396. The loading wagons are at y=424 and are
therefore *nearer*. Both live in `scenery-back`, and the pickups were appended afterwards —
so a hi-rail truck was painted halfway up the side of a boxcar standing in front of it.

It does not look like a layering bug. It looks like clutter, and I spent a round thinning
the background trying to fix "too much overlap" before looking closely enough to see that
one object was simply in front of something it should have been behind.

Within a single SVG layer there is no z; the append order is the whole depth model. Sort by
y before you emit, or write the block in depth order and keep it that way.

### A tab on a post lands on whatever is behind it

The yard gate's posts carried a yellow cap. The posts are 34px tall and stand at y=442; the
wagons behind them are at y=424, so the caps landed exactly on the wagons' underframes and
read as yellow blobs stuck to the side of a wagon. Anything on top of a vertical prop needs
checking against what is directly behind it at that height — a fence post, a signal, a lamp,
a mast. The prop reads fine; the thing on top of it does not.

### A hanging load needs daylight and needs to be the same KIND of thing

Bailey Yard's crane held a narrow green box sitting flush on the top container of the wagon
beneath it. It read as a third container stacked on the pile, because that is exactly what
it looked like: no gap, and a different width from everything around it.

Two things make a load read as *hanging*: about 25-30px of visible air under it, and being
the same kind of object as the ones it is about to join — same width, same corner posts,
same ribbing. Then the spreader beam goes on top, wider than the load, with the ropes
landing on its ends rather than passing behind it.

Derive the hook height from the target: `HOOK_Y = deck_top - gap - load_h - spreader_h`.
Pick it by eye and it will be flush the moment any of those change.
