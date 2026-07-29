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
| `build-gallery.py` | Builds **`tools/train-gallery.html`** (committed) — an inspection page with every vehicle (wheels turning, colours changeable) and preset consists running across the Colorado scene. Self-contained; opens from disk. | `python3 tools/build-gallery.py` |
| `gen-scenes.py` | Generates the location scenes into **`play/assets/scenes/`**. Owns the shared furniture (road, track, both crossing gates) so every scene lines up exactly; each scene supplies only artwork. `colorado.svg` is hand-authored and NOT generated. | `python3 tools/gen-scenes.py` |
| `build-scene-gallery.py` | Builds **`tools/scene-gallery.html`** (committed) — all eight locations with their trains running through them. The quickest way to spot a scene bug. | `python3 tools/build-scene-gallery.py` |
| `shot.js` | Renders any SVG or HTML file to PNG so you can *look* at it. Reports page errors too. | `node tools/shot.js <input> [out.png] [w] [h]` |

## The two galleries are committed

`tools/train-gallery.html` and `tools/scene-gallery.html` are checked into the repo on
purpose. They are the fastest way for anyone — a new contributor, a future session, the
maintainer on a phone — to see the current state of the art without running anything:
open the file, everything is inlined, no server and no build. Regenerate and re-commit
them whenever you touch the trains or the scenes, so what is in the repo is always what
the art actually looks like.

## Important

- **`steam.svg` is hand-authored** — edit `play/assets/trains/steam.svg` directly. Everything else in `play/assets/trains/` is generated, so changes there are overwritten by `gen-trains.py`.
- **`map-data.js` is generated.** Never edit it by hand; change `gen-map.js` and re-run. It exists because `fetch()` is blocked on `file://`, so the map has to be inlined as JS for the game to work when opened directly from disk.
- **Scenes are generated** by `gen-scenes.py` — except `colorado.svg`, which is hand-authored as the style reference. Edit the generator, not the output. See `SCENE_GUIDE.md`.
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
node tools/shot.js tools/train-gallery.html gallery.png 1400 1000
```

Adjust a scene:

```bash
python3 tools/gen-scenes.py
python3 tools/build-scene-gallery.py
node tools/shot.js tools/scene-gallery.html scenes.png 1400 1000
```
