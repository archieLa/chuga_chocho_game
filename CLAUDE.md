# Build brief for coding agents

**Read this file first, then `DESIGN.md`.** `DESIGN.md` is the full vision and roadmap (the "what" and "why"). This file is the "how to build it" — conventions, the current phase's ordered tasks with acceptance criteria, and the decisions that are still open. When something here conflicts with your defaults, this file wins. When something is genuinely undecided, **ask the maintainer — do not guess and silently commit an architecture choice.**

## What this project is

A gentle, spoken, bilingual (English + Polish) train-crossing learning game for kids ~3–5. See `DESIGN.md` §1.

## Hard rules (do not violate without asking)

1. **No framework, no required build step.** Vanilla HTML/CSS/JS + SVG only. The game MUST run by opening `play/index.html` directly (and when served statically on GitHub Pages). No React/Vue/Svelte, no bundler-as-a-requirement. A optional bundling script that *emits* a single-file version is fine, but the source must run un-built.
2. **Use classic scripts, not ES modules loaded over `file://`.** ES modules break under `file://` due to CORS. Either use classic `<script>` tags with a small global namespace, OR keep modules but document that a local server is required. Prefer classic scripts so double-click-to-run always works.
3. **The gate is always controllable** by the two on-screen buttons AND the physical `/open` `/close` `/status` endpoint, in every mode, with two-way sync. Never disable this. Port the working logic from `reference/crossing_playtime.html`.
4. **No losing, no pressure, no ads, no tracking, no external analytics, no data collection.**
5. **Everything on screen is also spoken** in the active language. Route all narration through `play/js/speech.js`.
6. **English is the default language; Polish ships day one.** All user-facing strings and spoken words come from per-language dictionaries so adding a language is data, not code.
7. **Persistence via `localStorage` only** (language, train customization, current location, settings). No backend.

## Conventions

- Keep modules small and single-purpose (see `play/js/` stubs; each file has a header describing its job).
- Comment for a beginner audience — this repo is also meant to be *read* by people learning to code.
- SVG art: group and name parts so they can be swapped/recolored (`fill`) at runtime (steam vs electric engine, loco color, wagon type).
- Test by opening the game and clicking through; there is no automated test suite yet (adding a light one is welcome).

## Reference material

- `reference/crossing_playtime.html` — the **original working game** (single-file canvas). It already implements: gate open/close animation with easing, flashing lights, warning bell, whistle, chug and honk sounds (Web Audio), cars that stop at the gate, and the **physical-device polling + two-way sync**. **Port this logic; don't reinvent it.** Its visuals are placeholder — the new version replaces canvas rectangles with SVG storybook art.

## Phase 1 — Free Play (build in this order)

Do these roughly in sequence; each should be a reviewable commit (or small PR). "Done" = the acceptance criteria pass when a human opens the game.

### 1.1 Project shell & port the core loop
- Wire up `play/index.html` + the `js/` modules into a running game.
- Port the gate state machine, sounds, cars, and physical-device sync from the reference game.
- Default language English; add the language toggle (EN/PL) and `localStorage` persistence.
- **Done when:** the game runs from `play/index.html`, the two buttons lower/raise the gate with bell + lights, a train crosses, cars stop, and the language toggle changes spoken output between English and Polish.

### 1.2 Fix the gate geometry
- Two gate arms, one on **each side of the road**, that lower to meet in the middle. Crossbuck sign + alternating flashing lights + bell.
- **Done when:** at a road crossing, both arms are visibly present and lower/raise symmetrically to block both directions.

### 1.3 SVG storybook rendering
- Replace canvas-rectangle art with layered SVG (parallax: sky → far → mid → foreground → track). Flat storybook style (see `DESIGN.md` §3).
- **Done when:** the default scene is illustrated (not rectangles), scales crisply, and layers move with subtle parallax.

### 1.4 World / location system
- A scene is defined by data (a location descriptor) that the renderer consumes, so locations are swappable.
- Implement at least 2 locations end-to-end (suggest Colorado + California/San Francisco) to prove the system; stub the rest from `DESIGN.md` §6.
- **Done when:** switching the active location reskins the background, and adding a new location is a matter of adding data + art.

### 1.5 US map navigation
- A globe/map icon → zoom into a **real US map** → tap a state → if multiple cities, pick one → exit → world updates → the place name is **spoken**.
- Needs a US map source (see open decisions).
- **Done when:** a child can tap the map, choose a supported state/city, and land back in a reskinned world with the place named aloud.

### 1.6 Train customizer
- Train icon → choose engine type (steam / diesel-electric / electric), loco color, wagon color, wagon type (boxcar / container / passenger / gondola / tanker). Choices persist and override per-location presets.
- **Done when:** changes render immediately on the train, survive reload, and per-location presets apply only until the user overrides them.

### 1.7 Car counter
- Count road cars that pass the crossing before the gate closes; settings toggle to show/hide.
- **Done when:** the counter increments correctly and can be hidden/shown from settings, persisting the choice.

Phase 1 also carries: settings panel (⚙️), the landing page (`/index.html`), and keeping the physical-gate config working.

## Open decisions — ASK before choosing

These are real forks the maintainer should weigh in on:

1. ~~**US map source**~~ **RESOLVED.** A static, offline SVG US map is committed at `play/assets/us-map.svg` (and inlined for `file://` use at `play/js/map-data.js`), generated from us-atlas (Natural Earth, public domain) with an Albers-USA projection, integer-rounded (~77 KB, 51 states). Each `<path>` carries `data-name`; supported states also carry `data-supported="true"` and optional `data-cities="City|City"`. The picker (`play/js/map.js`) is built and wired to the 🗺️ button. To regenerate/adjust, see `mapgen/gen.js` in the build history (not committed) or re-run the same pipeline. **Do not swap this for a runtime map dependency.**
2. **Art pipeline** — who/what produces the SVG illustrations (hand-authored SVG committed to `assets/`, vs. generated art)? This is the biggest time cost. Agree on a style reference before mass-producing scenes.
3. **Module style** — classic global-namespace scripts (double-click friendly) vs. ES modules (needs a local server). *Recommendation: classic scripts, per hard rule #2.*
4. **Single-file bundle** — is an optional build script that inlines everything into one `.html` wanted for offline sharing, and if so, plain Node script or something else?
5. **Voice consistency** — `SpeechSynthesis` voices vary by device/OS; decide how to pick/prefer voices and how to degrade gracefully when a language's voice is missing.

Log any decision you make into `DESIGN.md` so the next contributor inherits it.
