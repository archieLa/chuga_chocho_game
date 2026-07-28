# tools/

Asset generators and review helpers. **None of this runs in the game** — these scripts *produce* the files in `play/assets/` and `play/js/`, then you commit the output. The game itself stays dependency-free.

## Setup

```bash
cd tools
npm install          # d3-geo, topojson-client, us-atlas, playwright
```

Python scripts need only Python 3 (standard library).

## The tools

| Script | What it does | Run |
|---|---|---|
| `gen-map.js` | Builds the US map for the location picker from public-domain [us-atlas](https://github.com/topojson/us-atlas) data (Albers USA). Every state gets its two-letter abbreviation; playable states are highlighted and carry `data-cities`. Writes **`play/assets/us-map.svg`** and **`play/js/map-data.js`**. | `node tools/gen-map.js` |
| `gen-trains.py` | Generates every locomotive and wagon plus `manifest.json` into **`play/assets/trains/`**. Shared helpers keep wheels, bogies, couplers and underframes consistent across all vehicles. | `python3 tools/gen-trains.py` |
| `build-gallery.py` | Builds **`train-gallery.html`** — an inspection page with every vehicle (wheels turning, colours changeable) and preset consists running across the Colorado scene. Self-contained; opens from disk. | `python3 tools/build-gallery.py` |
| `shot.js` | Renders any SVG or HTML file to PNG so you can *look* at it. Reports page errors too. | `node tools/shot.js <input> [out.png] [w] [h]` |

## Important

- **`steam.svg` is hand-authored** — edit `play/assets/trains/steam.svg` directly. Everything else in `play/assets/trains/` is generated, so changes there are overwritten by `gen-trains.py`.
- **`map-data.js` is generated.** Never edit it by hand; change `gen-map.js` and re-run. It exists because `fetch()` is blocked on `file://`, so the map has to be inlined as JS for the game to work when opened directly from disk.
- **Scenes are hand-authored art** (`play/assets/scenes/`), not generated. See `SCENE_GUIDE.md`.
- **Always render and look** after an art change — `shot.js` exists for exactly this. Sliced trees and floating wheels don't show up in a diff.

## Typical loops

Change the supported states or a map label:

```bash
node tools/gen-map.js
node tools/shot.js play/assets/us-map.svg map.png 1100 700
```

Change a wagon or locomotive:

```bash
python3 tools/gen-trains.py
python3 tools/build-gallery.py
node tools/shot.js train-gallery.html gallery.png 1400 1000
```

Adjust a scene:

```bash
node tools/shot.js play/assets/scenes/colorado.svg
```
