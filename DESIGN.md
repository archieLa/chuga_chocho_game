# Chuga Chocho — Design & Roadmap

*A free, open-source, bilingual (English + Polish) learning game for young children, grown from the original "crossing gate" train game.*

Status: **Phase 1 — Free Play complete and playable. Phase 2 (mission modes) is next.** · Live at https://archiela.github.io/chuga_chocho_game/ · Last updated: 2026-07-29

**Companion docs:** `SCENE_GUIDE.md` (how to author a location scene) · `CLAUDE.md` (build brief + art conventions for coding agents).

---

## 1. Vision

A gentle, screen-friendly train game for kids roughly **ages 3–5** that teaches through play:

- **Cause & effect** — press a button (or a real physical button), the crossing gate lowers, the train crosses.
- **Geography** — travel the United States by picking states and cities on a real map; each place reskins the whole world.
- **Trains** — recognize and customize real train types (steam, diesel-electric, electric).
- **Early academics** — counting, colors, letters, and spelling, delivered as optional mini-games.
- **Language** — every prompt is spoken aloud in **English (default) or Polish**, more languages later.

It runs in any browser with no install, is free to download, is playable directly on a public website, and can optionally drive a **real physical crossing gate** over the local network.

### Why it exists

The game started as something one dad built for his son. It is being opened up so that any
kid can play it for nothing, and so that whatever it raises goes to a **children's hospital**.
That is the point of the project, and it sets the bar for the work: the art gets iterated
until it is genuinely good, the game never nags or upsells, and nothing about it costs a
family anything. When a decision is close, pick the one that is better for the kids.

## 2. Design principles

- **No losing, no pressure.** Nothing punishes a child. "Wrong" answers get a gentle, encouraging response.
- **Big, forgiving touch targets.** Designed for small fingers on a tablet.
- **Everything is spoken.** A pre-reader should be able to play by ear.
- **The gate is always controllable.** Both on-screen buttons **and** the physical gate endpoint work in *every* mode, always, with two-way sync.
- **Anyone can reach it.** Non-technical visitors get a friendly page and one Play button.
- **Web-native and open.** Plain HTML/CSS/JS + SVG. No framework, no build tool required to run. MIT, hosted free on GitHub Pages.

## 3. Art direction

**Flat storybook illustration** — a children's picture book that moves. Layered parallax scenery, clean shapes, gentle shadows. Not photorealistic, but **detailed enough that a child can recognise a place and a locomotive type**.

Art is authored **interactively with a human reviewing** — rendered, looked at, iterated — *not* generated unattended. Colorado took eight passes; that loop is the process.

`play/assets/scenes/colorado.svg` is the **locked style anchor**. See `SCENE_GUIDE.md`.

## 4. Technical architecture

- **Stack:** vanilla JS + **SVG**, animated with `requestAnimationFrame`. No framework.
- **Why SVG:** crisp at any size, and parts can be swapped/recoloured — an engine type is a group swap, a colour change is one `fill`.
- **Repo layout:**
  - `index.html` — public landing page · `play/` — the game
  - `play/css/`, `play/js/`, `play/assets/` (`scenes/`, `trains/`) — styles, engine modules, art
  - `tools/` — asset generators (`gen-scenes.py`, `gen-trains.py`, `gen-map.js`), the inliner (`inline-assets.py`), the review harness (`shot.py` / `shot.js`) and the gate mock (`fake-gate.py`)
  - `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CLAUDE.md`, `SCENE_GUIDE.md`, `reference/`
- **Persistence:** `localStorage` (language, train customization, location, settings).
- **Runs from `play/index.html`** directly — classic scripts, no modules. Anything the game must load at runtime is **inlined as JS** (`map-data.js` for the map, `asset-data.js` for every scene and vehicle), because `fetch()` is blocked on `file://`. **The game only ever reads the inlined copies** — see the note in §11.
- **Cache note:** GitHub Pages caches assets ~10 min. Use `?v=N` when publishing, or hard-refresh.

## 5. Trains

- **Engine types (8 powered):** steam, diesel-electric, high-speed electric, commuter EMU, streetcar, cable car, cane plantation tank, monorail — also the *history* of trains, narratable as a lesson.
- **Wagons:** old passenger coach, caboose, modern bilevel coach, high-speed coach, boxcar, tank car, coal hopper, double-stack container.
- **Customization, always available:** colours are user-changeable any time and **persist**. **Colour is per vehicle instance** — each wagon in a consist keeps its own colour.
- **Per-location presets** suggest a fitting train; manual choices override and stick.
- **Art:** separate recolourable SVG pieces, never baked into scene art. Conventions and the valve-gear maths are in `CLAUDE.md`.
- **Side rods are real geometry** — coupling rod, main rod, crosshead and piston driven by wheel angle, with chuff smoke on the same trigger. A favourite detail; keep it.

**Built:** all **18** vehicles (8 powered + 10 wagons) + `manifest.json`, generated by `tools/gen-trains.py` (steam is hand-authored). `tools/build-gallery.py` builds an inspection page. The child's consist is **one locomotive + exactly three wagons**; `play/js/trains.js` is the data layer and `play/js/customizer.js` the cycling UI.

## 6. World & locations (US map navigation)

A **map icon** → a **real map of the United States**. Every state carries its **two-letter abbreviation**; playable states are highlighted with a bolder label. Tapping a state turns it amber and reveals its **full name** — large, at the bottom of the picker, and **spoken aloud** — next to the places you can travel to. Statewide locations get a single button, so the interaction is identical everywhere. Choosing a place reskins the world and speaks the place name.

**Destinations, not states.** Every button names a real destination — a **city** (San Francisco, Chicago) or a **natural place** (Rocky Mountains, Grand Canyon) — and never just repeats the state name. How many destinations a state has follows **how many visually distinct looks it has**: California needs two because the Golden Gate and the palms of LA look nothing alike, while Colorado's icons are all one landscape. The **interaction** is what stays uniform, not the count — tap a state, see its full name, pick a destination. This also means new scenes are purely additive: a state earns another button whenever it earns another look.

The abbreviation-then-full-name flow is deliberate: the map stays uncluttered and readable, and the full name becomes the reward for tapping — which is where the learning happens. Small north-eastern states are labelled in a column off the coast with leader lines, as a classroom map does.

**Launch location set:**

| State | City / scene | Scenery | Train preset |
|---|---|---|---|
| Colorado | Rocky Mountains | Georgetown Loop trestle, tan Rockies, golden aspens, Clear Creek, red rock | steam |
| California | San Francisco | Golden Gate Bridge *as the crossing road*, bay, fog | cable car |
| California | Los Angeles | Palms, downtown skyline, hills | commuter |
| Illinois | Chicago | Skyline, elevated 'L', tunnel, Lake Michigan | commuter |
| Arizona | Grand Canyon | Layered canyon walls, mesas, rim pines, saguaro | diesel |
| New York | New York City | Brooklyn Bridge, subway tunnel | commuter |
| Washington | Seattle | Evergreens, ferry, Cascades | commuter |
| Louisiana | New Orleans | Bayou, streetcar, live oaks | streetcar |
| Texas | Austin | Bats off the Congress Avenue Bridge at sunset, the Capitol dome, Lady Bird Lake, food trucks | commuter |
| Texas | Houston | Shuttle *Independence* riding a 747, a Saturn V on its side, live oaks, hazy Gulf summer | diesel |
| Florida | Cape Canaveral | A rocket off Pad 39, the VAB, lagoon, saltmarsh, a gator | diesel |
| Hawaii | Oʻahu | Diamond Head, the reef, Waikiki, outriggers, hula | cane tank |
| Alaska | Denali | The Alaska Range over the Susitna flats, aurora, spruce, a moose | diesel |
| Nevada | Las Vegas | Neon, the Welcome sign, the Strip, desert mountains — **at night** | monorail |
| Utah | Moab | Delicate Arch over slickrock, the La Sals behind, juniper, a jeep | diesel |
| Tennessee | Nashville | Lower Broadway, honky-tonk neon on Victorian brick, a busker | diesel |
| Massachusetts | Boston | Back Bay across the Charles, the Esplanade, autumn | streetcar, **green** |

**17 destinations across 15 states.** California and Texas each have two, on exactly the rule
above. Three of these are worth knowing about from the engine side:

- **Austin is dusk and Las Vegas is night.** Every other scene is daylight. If a day/night
  tint, a brightness filter or ambient audio is ever added, these two are what it breaks.
- **Hawaii and Alaska are map insets.** `geoAlbersUsa` places them below the south-west,
  outside the mainland outline, so they are a separate hit-target problem from the rest.
- **Boston carries a livery, not just an engine.** Its preset is
  `{ engine:'streetcar', bodyColour:'#2f7d4a' }` — the Green Line. `trains.applyPreset()`
  honours `bodyColour` inside the same `userSet` guard as the engine, and a location with
  *no* `bodyColour` actively repaints the engine back to the default, so one place's livery
  can never follow the child to the next.

**Built (live):** the offline SVG map + picker — `tools/gen-map.js` generates `play/assets/us-map.svg` and the inlined `play/js/map-data.js` from public-domain us-atlas (Albers USA). Picker logic in `play/js/map.js`; locations in `play/js/world.js`. The map is the game's **front door**: it is what a child sees on launch, and the 🗺️ button brings it back. Choosing a place cross-fades the whole scene, applies the location's train preset (unless the child has overridden the engine) and speaks the name.

**The preset column above is the source of truth in `play/js/world.js`, not here** — if you change one, change both.

**Future — many cities per state:** more named cities each with their own scene (Colorado → Denver, Glenwood Springs). The chooser already supports it; it's data (name, scenery descriptor) plus art.

## 6.1 Scene structure (binding on the engine)

Full spec in `SCENE_GUIDE.md`.

- Scenes are **1280×720**, **horizon at y=300**; shared geometry identical everywhere so the engine can use fixed coordinates.
- The **road is a perspective ribbon** to a vanishing point on the horizon; mountains sit behind it.
- **Track band y=450–516** — no scenery props in it, or the train passes through them.
- **Two crossing gates** — near (`y=480`, larger) and far (`y=388`, smaller), one each side of the tracks; both lower together.
- **Cars travel in BOTH directions**, and **scale with distance** because the road is in perspective.
- **Three depth planes:** scenery behind the rails → the train corridor → foreground props. The train renders **between `#gate-far` and `#scenery-front`**.

## 7. Counter

Counts **road cars that pass before the gate closes**, with a settings toggle to show/hide. Feeds the counting learning mode.

## 8. Languages

- **English default; Polish day one**, via a settings toggle.
- Drives UI labels, button text and all narration (numbers, colours, letters, place names, praise).
- Browser `SpeechSynthesis` — no audio files.
- **Voice fallback:** a device may have no Polish voice at all. Silence would read as "the
  game is broken", so `speech.js` falls back — a local voice for the language, then any voice
  for it, then the default voice saying the words anyway.
- **Per-utterance language override.** `speech.say(text, { lang: 'en' })` speaks one line in
  another language. Used for place names that stay English (see the decisions log in §11).
- **More languages (e.g. Spanish) later** — per-language dictionaries, so adding one is data, not code.

## 9. Physical crossing gate

`GET /open` · `GET /close` · `GET /status` → `{ "state": "up" | "down" | "raising" | "lowering" }`. The game polls `/status` every 180 ms, so the physical button drives the screen and vice-versa. Found automatically at `crossinggate.local`; overridable in settings.

The firmware must send **`Access-Control-Allow-Origin`** on `/status` or the browser will not
let the game read it back. `tools/fake-gate.py` mocks the whole API (plus `/press`, the
physical button) for testing without hardware.

## 10. Public website (GitHub Pages)

The repo *is* the site. **Landing page** (`/`) — description, screenshot, big **▶ Play Now**, how to play in-browser and offline, physical-gate notes, source + licence. **The game** at `/play/`.

## 11. Roadmap

### Phase 1 — Free Play ✅ complete

1. ✅ Graphics overhaul — the committed SVG scenes are mounted and animated.
2. ✅ The gate — both scenes' gates, arms either side, crossbuck, flashing lamps, bell.
3. ✅ World background system — scenery reskins by location, cross-faded.
4. ✅ US map navigation — and the map is the game's front door.
5. ✅ Train customizer — engine, three wagons, per-instance colour, all persisted.
6. ✅ Car counter with show/hide toggle.

Plus: English + Polish speech and toggle, settings panel, `localStorage`, always-on buttons + physical-gate two-way sync, public landing page.

**Next:** Phase 2 — the mission modes.

#### Decisions taken while building the engine

These were open questions the plan left to whoever built it. Recorded here so the next
contributor inherits the reasoning rather than re-deriving it.

- **Assets are inlined by a generator, not fetched.** `tools/inline-assets.py` emits
  `play/js/asset-data.js`, the same solution `map-data.js` already used for the map. It also
  **namespaces every id inside each asset** (`s-seattle-sky`, `v-steam-boilerShade`), because
  the game keeps several scenes mounted at once and SVG resolves `url(#sky)` document-wide —
  without namespacing, Seattle silently borrows Colorado's sky. **Re-run it after any art change.**
- **Scenes are cached, never re-parsed.** Returning to a place you have already visited is
  instant, which is how a three-year-old uses a map.
- **The screen adopts the physical gate's position at connect,** not the other way round. A
  real arm swinging by itself the moment the game loads is a surprise; the physical thing in
  the room wins.
- **The hopeful `crossinggate.local` probe backs off for a day after it fails.** Looking for
  hardware that is not there costs a failed DNS lookup, and the browser prints that in the
  console on every launch. The Test button in settings always retries immediately.
- **The device firmware must send `Access-Control-Allow-Origin`.** Without it the game can
  command the gate but never read its state, so the physical button appears dead.
  `tools/fake-gate.py` is a stand-in that gets this right.
- **Place names are spoken by a voice that matches the name, not the UI language**
  (open decision #6, now settled). Names with no Polish form stay English *and are spoken by
  an English voice* — "Rocky Mountains" read with Polish phonetics is not recognisable. Names
  `world.js` does translate (Nowy Jork, Nowy Orlean, Wielki Kanion) are spoken in Polish.
  State names on the map are always English: they are American proper nouns.
- **The two gate buttons stay on every screen**, shrunk into the corner on the map, the
  customizer and settings. The hard rule says the gate is never unavailable, and a child
  mashing the button while the map is open should still get the bell.
- **The car counter defaults to ON.** `BUILD_PLAN.md` §H could be read either way; a counter
  that visibly counts is a small free counting lesson, and it is one tap to hide.
- **Closing the gate calls a train**, and holding it closed keeps them coming. Opening the
  gate never cancels one — nothing the child does can go wrong.

### Phase 2 — Learning Modes ← next

Missions framework, difficulty levels, no-fail encouraging feedback. The gate buttons / physical button are how the child answers.

- **Count & Close** — close after *N* cars of a colour ("5 blue"); combos for harder levels.
- **Letter Hunt** — show a word (**TRAIN**); cycle the alphabet; close the gate on each next letter in order.
- **Picture Word** — show a picture; cycle words; close when the naming word appears.

**The ordered work list for this phase is `BUILD_PLAN.md` §11** — tasks I–N with contracts and
acceptance criteria. Two things it settles that belong here as decisions:

- **Missions are optional layers, never a replacement.** Free Play stays the default mode and
  stays exactly as it is; a mission *interprets* a gate press but never withholds one. `modes.js`
  is the registry, and it still boots into `freeplay` when nothing is chosen.
- **Car colours have to become nameable.** `scene.js` currently picks car colours from seven raw
  hexes that match neither `trains.PALETTE` nor the `colors` names in `i18n.js` (one is white,
  which has no name in either language). Count & Close cannot say "two red cars" until that is
  reworked into keyed colours, so it is the first task of the phase.

### Phase 3 — Polish & extend

More locations (incl. multiple cities per state), more languages, accessibility, **PWA/offline/installable**, richer sound, more vehicles, and a documented **physical-gate hardware kit**.

## 12. Educational payoff

Geography · train technology & history · counting · colours · letters & spelling · cause-and-effect · bilingual vocabulary (EN + PL).

## 13. Open-source setup

MIT · README with play/hosting/hardware instructions · CONTRIBUTING · GitHub Pages · single-file bundle for offline sharing.

---

## Appendix — Origin

Grown from `reference/crossing_playtime.html`: press the close/open buttons, gates lower with bell and flashing lights, a steam engine crosses, road cars stop and honk, with an optional physical-gate hookup and two-way sync. That mechanic is the seed everything grows from.
