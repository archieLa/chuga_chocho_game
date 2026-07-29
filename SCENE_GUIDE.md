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
- [ ] Nothing overlaps the road corridor
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

**All eight built.** Seven are generated by `tools/gen-scenes.py`, which owns the shared
furniture (road, track, both gates) so geometry can't drift and a gate can't go missing;
each scene supplies only its artwork, slotted into the correct depth layers. Colorado stays
hand-authored as the reference. Verify with `tools/build-scene-gallery.py`, which renders
every scene with a train running through it.

Scenes are authored **interactively with a human in the loop** (see `DESIGN.md` §3) — reviewed by eye and iterated, not generated unattended.
