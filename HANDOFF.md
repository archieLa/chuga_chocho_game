# Handoff — new cities and tools to integrate

Everything below is art and asset-pipeline work done outside the engine. **None of it
changes the engine contracts** in `CLAUDE.md` or `BUILD_PLAN.md` — the geometry, the layer
order, the gate coordinates and the recolour hooks are all unchanged.

---

## 1. Three new locations

| id | State | City | Scene file | Train preset |
|---|---|---|---|---|
| `austin` | Texas | Austin | `play/assets/scenes/austin.svg` | `commuter` |
| `houston` | Texas | Houston | `play/assets/scenes/houston.svg` | `diesel` |
| `cape` | Florida | Cape Canaveral | `play/assets/scenes/cape-canaveral.svg` | `diesel` |

That takes the game from 8 destinations to **11**. Texas now has two, exactly the way
California already has San Francisco and Los Angeles — no new picker behaviour is needed.
Florida is a new supported state.

Austin is the first **dusk** scene in the set. Nothing about it is special structurally, but
if the engine ever adds a day/night tint or ambient audio, it's the one that will show it.

---

## 2. ⚠️ The map must be regenerated — this is the one thing that will break

`tools/gen-map.js` now has `'Texas': ['Austin', 'Houston']` **and** `'Florida': ['Cape Canaveral']` in its `SUPPORTED` table, but the
**generated map files have not been rebuilt** (this environment doesn't have the npm deps).

Until someone runs this, **Texas and Florida will not be selectable on the map** even though the scenes
and the `world.js` entries exist:

```bash
cd tools
npm install                 # d3-geo, topojson-client, us-atlas
cd ..
node tools/gen-map.js       # rewrites play/assets/us-map.svg AND play/js/map-data.js
```

Then confirm Texas carries `data-supported="true"` with `data-cities="Austin|Houston"`, and
Florida carries `data-cities="Cape Canaveral"`.

---

## 3. If asset inlining (BUILD_PLAN task A) is already done

`play/js/asset-data.js` must be regenerated so the three new scenes are inlined, or they'll be
missing on `file://`. Re-run whatever `tools/inline-assets.py` ended up being called.

---

## 4. New tool: `tools/check-scenes.py`

```bash
python3 tools/check-scenes.py       # exit 0 = clean, 1 = something to fix
```

Verifies every scene: XML validity, both gates present, near-gate geometry unchanged, layer
order, unresolved `url(#…)` / `href="#…"` references (they render as solid black), and —
the new one — **props standing in the road**.

That last check matters for the engine. The road is a perspective ribbon, so its width
depends on `y`: at `y=400` the carriageway is roughly `x=595..674`, but at `y=700` it's
`x=515..764`. A bench that looks safely off to the side near the horizon is in the middle of
the lane at the bottom of the frame. Once cars are driving, they pass straight through
anything parked there.

**Worth running from the engine side too**, as a pre-commit or CI step — it's pure stdlib
Python, no dependencies, and it takes under a second.

---

## 5. Files changed

**New**

- `play/assets/scenes/austin.svg`
- `play/assets/scenes/houston.svg`
- `play/assets/scenes/cape-canaveral.svg`
- `tools/check-scenes.py`
- `SCENE_ROADMAP.md` — the plan for the remaining 43 states (planning only, no code impact)
- `HANDOFF.md` — this file

**Modified**

- `tools/gen-scenes.py` — added `austin()`, `houston()` and `cape_canaveral()`; moved ten props out of the road
  in six existing scenes (see below)
- `tools/build-scene-gallery.py` — Austin, Houston and Cape Canaveral added to `CATALOGUE`
- `tools/gen-map.js` — `'Texas': ['Austin', 'Houston']` and `'Florida': ['Cape Canaveral']` added to `SUPPORTED`
- `tools/README.md` — documents `check-scenes.py`
- `tools/scene-gallery.html` — regenerated, now 11 scenes
- `play/js/world.js` — three new location entries (`austin`, `houston`, `cape`)
- `SCENE_GUIDE.md` — status table plus four new lessons-learned rows

**Regenerated (do not hand-edit)**

- all eleven files in `play/assets/scenes/` come from `tools/gen-scenes.py`, except
  `colorado.svg`, which stays hand-authored as the style reference

---

## 6. Existing scenes that changed, and why

Six shipped scenes had a prop standing in the carriageway. Art-only moves of a few pixels —
nothing structural, no geometry touched — but they matter because the engine drives cars
down that road:

| Scene | What was in the road | Moved to |
|---|---|---|
| `sf` | street lamp at (700, 670) | (806, 670) |
| `chicago` | street lamp at (700, 660) | (802, 662) |
| `nyc` | street lamp at (700, 664) | (804, 666) |
| `seattle` | street lamp (720, 670), bench (560, 700), gull (560, 596) | (808, 672), (428, 700), (486, 596) |
| `new-orleans` | prop at (640, 706) | (438, 706) |
| `grand-canyon` | yucca (640, 712), agave (700, 624) | (452, 712), (806, 624) |

`houston` and `cape-canaveral` both hit the same thing in their first drafts — an astronaut, a
bench, two visitors and a fence that ran straight across the road in Houston; two spoonbills in
the Cape. All caught by `check-scenes.py` and fixed before either shipped.

---

## 7. What has NOT changed

- Scene geometry: 1280×720, horizon `y=300`, track band `y=450–516`, road polygon
  `510,720 · 770,720 · 658,300 · 622,300`
- Gate coordinates: near `x=552/728, y=480, scale 1.2`; far `x=580/700, y=388, scale 0.82`
- Layer order and the train slot between `#gate-far` and `#scenery-front`
- Anything in `play/assets/trains/`, `manifest.json`, or the recolour hooks
- `play/js/trains.js`, `i18n.js`, or any other engine module
