# Chuga Chocho — Design & Roadmap

*A free, open-source, bilingual (English + Polish) learning game for young children, grown from the original "crossing gate" train game.*

Status: **planning → Phase 1** · Last updated: 2026-07-25

---

## 1. Vision

A gentle, screen-friendly train game for kids roughly **ages 3–5** that teaches through play:

- **Cause & effect** — press a button (or a real physical button), the crossing gate lowers, the train crosses.
- **Geography** — travel the United States by picking states and cities on a real map; each place reskins the whole world.
- **Trains** — recognize and customize real train types (steam, diesel-electric, electric).
- **Early academics** — counting, colors, letters, and spelling, delivered as optional mini-games.
- **Language** — every prompt is spoken aloud in **English (default) or Polish**, with more languages added later.

It runs in any web browser with no install, is free to download and play, is playable directly on a public website, and can optionally drive a **real physical crossing gate** over the local network.

## 2. Design principles

- **No losing, no pressure.** Nothing punishes a child. "Wrong" answers get a gentle, encouraging response, never a failure.
- **Big, forgiving touch targets.** Designed for small fingers on a tablet.
- **Everything is spoken.** A pre-reader should be able to play by ear. All text is also narrated.
- **The gate is always controllable.** The two on-screen buttons **and** the physical gate endpoint work in *every* mode, always. Two-way sync between screen and hardware is never disabled.
- **Anyone can reach it.** Non-technical people get a friendly public web page and a single "Play" button — no install, no code, no accounts.
- **Web-native and open.** Plain HTML/CSS/JS + SVG. No framework, no build tool required to run. One public repo, MIT-licensed, hostable free on GitHub Pages.

## 3. Art direction

**Flat storybook illustration** — like a children's picture book that moves. Soft gradients, layered parallax scenery (sky → far mountains → near hills → foreground → track), clean shapes, gentle shadows. Not photorealistic or 3D, but **detailed enough that a child can recognize a real steam engine vs. an electric one, and recognize a place** (Golden Gate Bridge, Chicago skyline, red-rock desert).

Implication: backgrounds and train parts are **illustrated art assets** (SVG scenes, and/or generated illustration art), not just code shapes. Producing that art is its own kind of work, budgeted into each phase.

## 4. Technical architecture

- **Stack:** Vanilla JavaScript + **SVG** for art, animated with `requestAnimationFrame`. Layered scene (parallax). No framework.
- **Why SVG:** stays crisp at any screen size, and lets us **swap and recolor parts** — a steam engine becomes an electric engine by swapping an SVG group; changing locomotive color is one `fill` change.
- **Repo structure:**
  - `index.html` — **public landing page** (description, big "Play" button, how-to-play, download, hardware notes)
  - `play/` — the game itself (`play/index.html` + engine + assets)
  - `play/css/`, `play/js/`, `play/assets/` — styles, engine modules (scene, trains, world/locations, learning modes, speech, gate/device, settings), and SVG art
  - `README.md`, `LICENSE` (MIT), `CONTRIBUTING.md`, `CLAUDE.md` (agent build brief), `reference/` (original game)
  - optional `build` step to produce a single bundled `.html` for easy offline sharing
- **Persistence:** `localStorage` for chosen language, train customization, current location, and settings.
- **Runs by opening `play/index.html`** (classic scripts, no module/CORS issues) and by hosting on GitHub Pages.

## 5. Trains

- **Engine types:** steam, diesel-electric, electric. (These are also the *history* of trains — narratable as a lesson.)
- **Customization, always available:** locomotive color and wagon color are user-changeable at any time and **persist** — e.g. a favorite blue. User choices override the per-location presets.
- **Wagon types:** boxcar, container, passenger, gondola (open), tanker. One wagon selectable in the customizer (train may show several of that type).
- **Per-location presets:** picking a place auto-suggests a fitting train (e.g. Colorado → narrow-gauge steam), but any manual color/type choice sticks until the user changes it.
- **UI:** a train icon opens the customizer.

## 6. World & locations (US map navigation)

A **map/globe icon** on screen. Tapping it zooms into a **real map of the United States**. Tap a **state**; if the state has more than one supported **city**, pick one. Exit the map and the background world reskins to match. The state/city name is **spoken aloud** in the active language (this is the geography lesson).

Real-map (not simplified) is chosen deliberately for teaching value.

**Launch location set (all included):**

| State | City / scene | Scenery |
|---|---|---|
| Colorado | (statewide) | Rocky Mountains, pine forest, stream/waterfall, snowy peaks — narrow-gauge steam country |
| Illinois | Chicago | Skyline, elevated 'L' tracks, a tunnel, Lake Michigan |
| California | San Francisco | Golden Gate Bridge *as the crossing road*, bay |
| California | Big Sur | Ocean, cliffs, coastal mountains |
| Arizona | (statewide) | Red-rock desert, cacti, canyon mesas (warm-color contrast) |
| New York | New York City | Brooklyn Bridge, subway tunnel |
| Washington | Seattle / Cascades | Evergreens, ferry on the water, mountains |
| Louisiana | New Orleans | Bayou, streetcar, live oaks |

Open to adding more over time (Utah arches, Alaska, etc.).

## 7. Counter

Counts the **road cars that pass the crossing before the gate closes**. A **settings toggle** shows or hides the counter. Feeds naturally into the counting learning mode.

## 8. Languages

- **English is the default; Polish is supported from day one.** Selectable via a **settings toggle**.
- The chosen language drives **UI labels, button text, and all spoken narration** (numbers, colors, letters/words, state names, praise).
- Speech via the browser's built-in `SpeechSynthesis` (no audio files, free, multi-language).
- **Additional languages (e.g. Spanish) come in a later phase** — the content is structured as per-language dictionaries so adding one is data, not new code.

## 9. Physical crossing gate

Unchanged contract from the current game, kept first-class in all modes:

- `GET /open` — raise the gate
- `GET /close` — lower the gate
- `GET /status` → `{ "state": "up" | "down" | "raising" | "lowering" }`
- The game **polls `/status`** so a press of the *physical* button drives the on-screen gate, and on-screen/button actions drive the hardware. Configured via the gear/settings panel (device address).

---

## 10. Public website (GitHub Pages)

The repo doubles as a free public website served at `https://<user>.github.io/chuga-chocho/`. Because the game is HTML/JS, the same site can both **describe** the game and **be** the game.

**Two layers, one site:**

- **Landing page** (`/`, root `index.html`) — friendly storefront: plain-language description, a screenshot/GIF, a big **"▶ Play Now"** button, how to play in-browser and offline, physical-gate notes for tinkerers, and a footer link to the source + license.
- **The game** (`/play/`) — the playable app, opened by the Play button.

One link serves everyone: parents tap Play; coders scroll for download and hardware instructions.

## 11. Roadmap (phased)

### Phase 1 — Free Play (foundation) ← *current*

1. **Graphics overhaul** — SVG storybook engine with parallax layers.
2. **Fix the gate** — arms on **both sides of the road** meeting in the middle; crossbuck, flashing lights, bell.
3. **World background system** — layered scenery that reskins by location.
4. **US map navigation** — globe/map icon → real US map → state → optional city → world updates + spoken place name.
5. **Train customizer** — engine type, loco & wagon color, wagon type; per-location presets with persistent user overrides.
6. **Car counter** — count road cars before gate closes, with a show/hide settings toggle.

Plus: English + Polish speech and language toggle (English default), settings panel, `localStorage` persistence, always-on button + physical-gate controls with two-way sync, and the public landing page.

*(See `CLAUDE.md` for the ordered build tasks and acceptance criteria.)*

### Phase 2 — Learning Modes (challenge mini-games)

A "missions" framework with **difficulty levels** and no-fail, encouraging feedback. The gate buttons / physical button are how the child answers.

- **Count & Close** — close the gate after *N* cars of a color pass (e.g. "5 blue cars"); harder levels use combos ("5 blue **and** 3 red").
- **Letter Hunt (spelling)** — show a target word (e.g. **TRAIN**); cycle the alphabet; close the gate as each next letter appears in order (T, R, A, I, N).
- **Picture Word** — show a picture; cycle candidate words; close the gate when the naming word appears.

All modes speak prompts in the selected language, with celebratory rewards.

### Phase 3 — Polish & extend

More locations, **more languages (Spanish and beyond)**, accessibility pass, **PWA / offline / installable**, richer sound design, more vehicles/animals, and a documented **physical-gate hardware kit** (wiring + firmware).

---

## 12. Educational payoff (summary)

Geography (US states & cities, real map) · train technology & history (steam → diesel → electric) · counting · colors · letters & spelling · cause-and-effect · bilingual vocabulary (English + Polish, more later).

## 13. Open-source setup

MIT license · README with play + hosting + hardware instructions · CONTRIBUTING guide · **GitHub Pages hosting (landing page + playable game)** · single-file bundle for easy offline sharing.

---

## Appendix — Origin

Grown from the original single-file canvas game (`reference/crossing_playtime.html`, "Chuga Chocho! — Crossing!"): press the close/open buttons, gates lower with bell + flashing lights, a steam engine crosses, road cars stop and honk, with an optional physical-gate hookup and two-way sync. That mechanic is the seed everything here grows from.
