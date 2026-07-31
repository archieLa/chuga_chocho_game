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
| `build-scene-gallery.py` | Builds **`tools/scene-gallery.html`** (committed) — every location with its train running through it. The quickest way to spot a scene bug. | `python3 tools/build-scene-gallery.py` |
| `inline-assets.py` | Bakes every scene, every vehicle and `manifest.json` into **`play/js/asset-data.js`** so the game runs from `file://` (where `fetch()` is blocked). Namespaces the ids inside each asset so several scenes can be mounted at once without their `<defs>` colliding. **Re-run after ANY change to `play/assets/`.** | `python3 tools/inline-assets.py` |
| `shot.js` | Renders any SVG or HTML file to PNG so you can *look* at it. Reports page errors too. | `node tools/shot.js <input> [out.png] [w] [h]` |
| `shot.py` | The same review loop without Node: drives headless Google Chrome over the DevTools Protocol using only the Python standard library. Taps with **real** input events (a synthetic `.click()` is not a user gesture, so it neither unlocks audio nor proves the console is clean), can run JS before the shot, and prints every console message (exit code 1 if any were errors or warnings). | `python3 tools/shot.py play/index.html out.png --wait 3 --click '#closeBtn'` |
| `check-scenes.py` | Validates every scene: XML validity, both gates present, near-gate geometry unchanged, layer order, unresolved `url(#…)` / `href="#…"` references (they render solid black), and **props standing in the road**. That last one matters because the road is a *perspective ribbon* — at `y=400` the carriageway is roughly `x=595..674`, but at `y=700` it is `x=515..764`, so a bench that looks safely aside near the horizon sits in the middle of the lane at the bottom of the frame, and cars drive straight through it. Pure stdlib, under a second — worth running before every scene commit. Exit 0 = clean. | `python3 tools/check-scenes.py` |
| `fake-gate.py` | A stand-in **physical crossing gate** for testing the two-way sync with no hardware. Speaks the real device API — `/open`, `/close`, `/status` — plus `/press`, which acts as the physical button so you can check that the device moves the screen. Sends the CORS header the real firmware must send. Put `127.0.0.1:8099` in the game's ⚙️ settings. | `python3 tools/fake-gate.py 8099` |

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
- **`asset-data.js` is generated** by `inline-assets.py`. The game reads the inlined copy, never the files in `play/assets/`, so **art you change does not reach the game until you re-run the generator.** If a scene edit "does nothing", this is why.
- **Always render and look** after an art change — `shot.js` (or `shot.py` if you have no Node) exists for exactly this. Sliced trees and floating wheels don't show up in a diff.

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
python3 tools/check-scenes.py      # <- catches props standing in the road
python3 tools/build-scene-gallery.py
node tools/shot.js tools/scene-gallery.html scenes.png 1400 1000
python3 tools/inline-assets.py     # <- or the game will not see your change
```

Adding a location? Four places must agree — `play/js/world.js`, `gen-scenes.py`,
`SUPPORTED` in `gen-map.js`, and a re-run of `inline-assets.py`. Miss one and the place
fails *silently*. The runbook with the in-page cross-check is in `CLAUDE.md`.

Verify a change to the **game** (do both — they fail differently):

```bash
python3 tools/inline-assets.py                                          # only if art changed
python3 tools/shot.py play/index.html shot.png --size 1280x800 --wait 3  # file://
python3 -m http.server 8000 &                                            # then over http
python3 tools/shot.py http://localhost:8000/play/ shot-http.png --size 1280x800 --wait 3
```

Then **look at the PNG.** Reading your own diff is not looking at it. Exit code 1 means the
page logged an error or a warning; zero of both is the bar.

Test the physical-gate sync with no hardware:

```bash
python3 tools/fake-gate.py 8099    # put 127.0.0.1:8099 in ⚙️, then curl /press
```
