# Build plan — Phase 1, hand this to a coding agent

**Goal: a playable game.** All the art is finished and committed. What is missing is the
engine that puts it on screen and lets a three-year-old drive it.

Read `CLAUDE.md` (hard rules, art contracts) and `SCENE_GUIDE.md` (scene geometry) first.
This file is the ordered work list, the acceptance criteria, and the loop to run.

---

## 0. How to work

**Iterate until every box in §9 is ticked. Do not stop at "it compiles."**

The loop for every task:

1. Implement the smallest complete slice.
2. **Run it and look at it** — `node tools/shot.js play/index.html shot.png 1280 800`, or drive
   it with Playwright. Reading the diff is not looking at it.
3. Check the browser console. **Zero errors, zero warnings** is the bar.
4. Re-read the task's "Done when" and be honest about whether it passes.
5. Only then move on.

Test in **both** of these, every time — they fail differently:

```bash
# 1. straight from disk, the way a parent will open it
open play/index.html            # or: node tools/shot.js play/index.html

# 2. over http, the way GitHub Pages serves it
python3 -m http.server 8000     # then http://localhost:8000/play/
```

Commit per task, small and reviewable. If a decision isn't covered here, pick the option a
tired parent would prefer at 6am and write down what you chose.

---

## 1. What already exists — do not rebuild it

| Asset | Where | State |
|---|---|---|
| 8 location scenes | `play/assets/scenes/*.svg` | **Final.** 1280×720, horizon y=300, track band y=450–516, both gates at fixed coords. |
| 14 vehicles + manifest | `play/assets/trains/` | **Final.** Recolour hooks and wheel data baked in. |
| US map | `play/assets/us-map.svg`, `play/js/map-data.js` | **Final**, offline, picker wired in `map.js`. |
| Location data | `play/js/world.js` | 8 locations, each with `scene`, `say` (en/pl) and `trainPreset`. |
| Consist data layer | `play/js/trains.js` | **Written for you.** Engine + 3 wagon slots, per-slot colours, cycling helpers, preset latch. Build the UI on top; don't redesign the model. |
| Language dictionaries | `play/js/i18n.js` | EN + PL, including the spoken welcome. |
| Galleries | `tools/scene-gallery.html`, `tools/train-gallery.html` | Working references — scene mounting, consist assembly from the manifest, wheel spin, recolouring. **Read these before writing a renderer.** |
| The original game | `reference/crossing_playtime.html` | 247 lines. Gate state machine, easing, bell/whistle/chug audio, cars that stop, and the physical-device two-way sync. **Port it. Do not reinvent it.** |

If you find yourself drawing art, stop — you are on the wrong track.

---

## 2. Hard rules

1. **The gate is always controllable** — the two on-screen buttons *and* the physical
   endpoint, in every mode, on every screen where the train runs, with two-way sync.
   Never disable either.
2. **No build step to play.** Classic `<script>` tags, global `CC` namespace, no ES
   modules, no bundler. `play/index.html` opened by double-click must work.
3. **`fetch()` is blocked on `file://`.** Anything loaded at runtime must be inlined as JS.
   See task A.
4. **English default, Polish day one.** Every string a child sees or hears comes from
   `i18n.js`. No hard-coded text anywhere.
5. **Never re-order a scene's layers.** Insert into them (task C).
6. **Colour is per vehicle instance.** Scope to the vehicle's own root, never
   `document.querySelectorAll`.
7. **Nothing punishes the child.** No timers, no fail states, no red X.

---

## A. Inline the assets so `file://` works

`fetch()` will not load the scene SVGs or `manifest.json` from disk. Fix this once, in a
generator, the same way `map-data.js` already solves it for the map.

- Write `tools/inline-assets.py` that emits **`play/js/asset-data.js`**:
  ```js
  CC.assets = {
    scenes:   { colorado: '<svg …>', sf: '…', /* all 8 */ },
    vehicles: { steam: '<svg …>', 'wagon-boxcar': '…', /* all 14 */ },
    manifest: { /* manifest.json verbatim */ }
  };
  ```
- Load it before the other modules in `play/index.html`.
- Add it to `tools/README.md` and re-run it whenever art changes.
- Parse with `DOMParser` and import nodes — never `innerHTML` for SVG, it drops namespaces.

**Done when:** `play/index.html` opened by double-click renders a scene with a train, no
network requests, no console errors.

---

## B. The shell: the map is the home screen

**The game opens on the map**, not in a scene. That is the front door: a child sees the
United States, taps a place, and rides there.

- Boot order: mount the map full-screen → speak the welcome → wait for a choice.
- **The welcome** comes from `i18n.t('welcome.sayAs')` — EN: *"Let's explore the United
  States. Time to ride… chuga chuga choo choo!"* PL: *"Zwiedzajmy Stany Zjednoczone. Czas
  na przejażdżkę… czuga czuga czu czu!"* (`welcome.text` is the readable spelling,
  `welcome.sayAs` is respelled so each language's TTS pronounces the brand sound
  correctly — say `sayAs`, display `text`.)
- **Browsers block speech before a user gesture.** Arm the welcome and fire it on the first
  tap/click/key anywhere, exactly like `unlock()` in the reference game. Once per launch —
  don't re-speak it when returning to the map mid-session.
- Once a place is chosen, the map slides away and the scene takes over. A 🗺️ button in the
  scene brings the map back; the gate keeps working while the map is open.
- Returning to a scene you have already visited must be instant — keep mounted scenes
  around rather than re-parsing.

**Done when:** launching the game shows the US map, the welcome is spoken in the active
language on first touch, tapping a state and picking a destination rides you there, and the
🗺️ button returns you to the map.

---

## C. Scene loading — put a location on screen

`play/js/scene.js`. The current file is a placeholder that draws rectangles; replace it.

- Mount `CC.assets.scenes[location.scene]` as the backdrop. Size it by its own `viewBox`
  (`0 0 1280 720`) with `preserveAspectRatio="xMidYMid slice"` so it fills any screen.
- **Find `#gate-far` and `#scenery-front` and insert `<g id="cc-train">` between them.**
  Everything animated goes there or in sibling groups placed by the same rule.
- **Use the scene's own gates.** `#gate-near` (posts x=552/728, y=480, scale 1.2) and
  `#gate-far` (x=580/700, y=388, scale 0.82) are already drawn. Rotate each arm group about
  its post top and alternate the two lamp circles. Both gates always move together.
- Road cars travel in **both** directions and **scale with distance** — the road is a
  perspective ribbon (`510,720 · 770,720 · 658,300 · 622,300`), so a car's scale and speed
  are functions of its `y`. Cars stop at whichever gate faces them.
- One `requestAnimationFrame` loop with real delta timing. Pause it when the tab is hidden.

**Done when:** each of the 8 locations renders full-bleed, both gates lower together, the
train passes **behind the near gate and in front of the far gate**, cars approach from top
and bottom and stop when the gate is down, and nothing clips into the track band.

---

## D. Map → world

`map.js` already renders the map and calls `CC.world.select(id)`, which persists the choice
and emits `location`. Nothing listens yet.

- Subscribe in `scene.js`: swap the backdrop, cross-fade rather than cut.
- **Preserve gate state across the swap.** If the gate is down it stays down — the physical
  device must never desync because the child changed states mid-crossing.
- Apply `location.trainPreset` via `CC.trains.applyPreset()`, which already no-ops once the
  child has chosen an engine. Don't second-guess it.
- `world.select()` already speaks the place name. Don't speak it twice.
- The 8 ids are `colorado, sf, la, chicago, arizona, nyc, seattle, neworleans` and must stay
  in sync with `SUPPORTED` in `tools/gen-map.js`.

**Done when:** picking any of the 8 destinations reskins the world, applies its preset engine
(unless overridden), speaks the name in the active language, keeps the gate as it was, and
survives a reload.

---

## E. The train customizer — cycle, see, colour

The feature the child will use most. `CC.trains` is the data layer and is done; build the UI.

**Shape: one locomotive + exactly three wagons.** Four slots, each independently selectable
and independently coloured.

- **A cycling picker, not a grid.** The child sees **one vehicle at a time, large and
  centred**, with a big ◀ and ▶ either side. Pressing an arrow swaps to the next vehicle
  *in place* so they can look through the whole catalogue like a picture book:
  6 engines (`CC.trains.ENGINES`) for the loco slot, 8 wagons (`CC.trains.WAGONS`) for each
  wagon slot. Call `CC.trains.cycleEngine(±1)` / `cycleWagon(slot, ±1)`.
- **Slot selector:** a row of four taps along the bottom — 🚂 · 1 · 2 · 3 — showing the
  current little train. Tapping one selects that slot; the big preview and the colour
  swatches follow it. It should be obvious which slot is selected.
- **Colour swatches:** the six from `CC.trains.PALETTE`, big round taps. Tapping one applies
  to the *selected slot only* via `setBodyColour(slot, hex)`. Three wagons, three colours —
  if tapping blue turns the whole train blue, that's the bug rule 6 exists to prevent.
- **Speak everything.** Cycling says the vehicle's label; tapping a colour says the colour
  name from `i18n` `colors`. A pre-reader plays this by ear.
- **Live preview.** Render the vehicle from `CC.assets.vehicles[type]`, with its wheels and
  (for steam) its side rods turning slowly, so the child sees what they're choosing. The
  rods are the favourite detail — don't ship a static picture.
- **Layout from the manifest.** Each vehicle has `length` and `originFromRear`; a vehicle's
  origin sits `length - originFromRear` behind its front. Lay out from the front, stepping
  back `length + gap`. Never hard-code lengths.
- **Persistence** is already handled by `trains.js` — just don't bypass it.
- `tools/train-gallery.html` does swapping, assembly and recolouring already. It recolours
  **globally on purpose** because it is a catalogue. Read it; do not copy that part.

**Done when:** the child can cycle through all 6 engines and all 8 wagons seeing each one
animated, select any of the 4 slots, give **each wagon its own colour**, watch the change
land on the train in the scene immediately, hear each choice spoken, and find the identical
train after closing and reopening — and travelling the map does not overwrite it.

---

## F. Gate, audio, cars, and the physical crossing gate

Port from `reference/crossing_playtime.html`. It works; the bugs are already out of it.

- **Gate:** easing on the arms, alternating lamp flash, warning bell while lowering/down,
  cars stopping, an occasional impatient honk. `gate.js` already has the state machine and
  the `open/close/toggle/tick` interface — fill in `startPolling()`.
- **Audio:** Web Audio, created on first gesture (`unlock()`). Bell, whistle, chuff, honk.
  Chuff fires on the same quarter-revolution trigger that emits smoke, so sound and rods
  stay locked. A mute toggle in settings.

### The physical gate over mDNS

The device advertises itself on the LAN as **`crossinggate.local`**. Be straight about what
that means in a browser:

- **There is no JavaScript mDNS API.** You cannot enumerate devices. What works — and what
  the reference game does — is using the **`.local` hostname directly**: the OS resolves it
  via mDNS/Bonjour when the browser makes the request. So "connect over mDNS" means:
  default the address field to `crossinggate.local`, and let the OS do the lookup.
- **Auto-connect on launch.** If no address is stored, silently probe
  `http://crossinggate.local/status` with a ~2s timeout. If it answers, save it and start
  polling — the parent should never have to type anything in the normal case.
- Keep the manual address field for a typed hostname or a raw IP (`192.168.1.42`) as the
  fallback, plus a **Test** button reporting ✓ connected / ✗ not found.
- **Poll `/status` every ~180ms.** When the *device* initiates a change (someone pressed the
  physical button), drive `CC.gate.close(true)` / `open(true)`. Use the reference game's
  `gameInitiated` flag so a change the game just sent doesn't echo back and fight it.
- Reconnect quietly if the device drops. **Never block the game on the device** — no
  spinner, no error popup. If it's absent the on-screen game is simply unaffected.
- **⚠️ Mixed content.** GitHub Pages serves over **HTTPS**, and a browser will block an
  HTTPS page from fetching `http://crossinggate.local`. **The physical gate therefore only
  works from the local copy** (`file://` or a LAN `http://`). Detect
  `location.protocol === 'https:'` and, in settings, say so in one plain sentence — "to use
  the real gate, open the downloaded copy" — rather than showing a failure the parent will
  spend an evening debugging. Put the same note in `README.md`.

**Done when:** buttons and spacebar drive the gate with bell and lights; a real device at
`crossinggate.local` connects with no typing and stays in two-way sync (physical button
moves the screen, screen moves the gate); with no device the game plays identically; and the
HTTPS limitation is stated where a parent will actually see it.

---

## G. Language

- Settings shows **English / Polski** with flags or big labels; the choice persists.
- Switching re-localises the UI live via `i18n.apply()` and switches the speech voice —
  `speech.js` must pick a voice matching `i18n.dict.voice` and fall back gracefully when the
  device has no Polish voice (prefer any `pl-*`, then any voice, never silence).
- The welcome, place names, colour names, vehicle labels and button labels all speak in the
  active language.
- Place names stay **untranslated** by decision (`Rocky Mountains`, not a translation) except
  where `world.js` already gives a Polish form (`Nowy Jork`, `Nowy Orlean`, `Wielki Kanion`).
  Follow the data; don't invent translations.

**Done when:** flipping to Polski changes every visible label and everything spoken, and the
setting survives a reload.

---

## H. Car counter and settings

- Count road cars that clear the crossing. Big, friendly, top corner; hidden by default-off
  toggle in settings; persists.
- Settings panel (⚙️): language, car counter on/off, sound on/off, physical gate address +
  Test + the HTTPS note, and a "reset my train" that calls `CC.trains.reset()`.
- Everything in settings is two taps from the game and closes with one big Done.

---

## 9. Definition of done — the checklist

Tick every box by *doing it*, not by reading the code.

- [x] `play/index.html` **opened by double-click** works fully offline: map, all 8 scenes, train, gate, sound.
- [x] Same over `http://localhost:8000/play/`.
- [x] Zero console errors or warnings in both.
- [x] The game opens on the **US map** and speaks the welcome on first touch, in the active language.
- [x] All 8 destinations load, look right, and reskin the train to their preset.
- [x] Both gates lower together, everywhere, every time; the train renders between them.
- [x] Cars come from both directions, scale with distance, and stop at the gate.
- [x] The customizer cycles all 6 engines and all 8 wagons with a live animated preview.
- [x] **Three wagons, three different colours**, each chosen independently, all persisting.
- [x] Steam side rods move and stay locked to the wheels and the chuff.
- [x] EN ⇄ PL flips every label and every spoken line.
- [x] Gate works from buttons, spacebar, and a physical device at `crossinggate.local` with two-way sync — and works fine with no device at all.
- [x] Car counter counts, toggles, persists.
- [x] Nothing scary, nothing that can be lost, no dead ends — every screen has a way back.
- [x] A three-year-old can get from launch to a moving train **without help**. This is the real test.

### How each box was checked

Not by reading the diff. `tools/shot.py` drives a real headless Chrome over the DevTools
Protocol: it can tap with **real** input events (a synthetic `.click()` is not a user
gesture, so it neither unlocks audio nor proves the console is clean), run script in the
page, screenshot, and report every console message — exiting non-zero if any were errors or
warnings. The whole child journey was driven that way, over both `file://` and `http://`,
and every screenshot was looked at.

Two bugs that only a real run would have found, both now fixed:

- The consist template was built with `importNode` in a `while (src.firstChild)` loop.
  `importNode` copies rather than moves, so the loop never ended and the first frame hung the
  tab. Invisible in review; instant in a screenshot that never arrived.
- The ported `gameInitiated` echo flag got stuck true when the game connected to a device,
  and silently swallowed the first press of the physical button — the single most important
  interaction in the whole project. Found by testing against `tools/fake-gate.py`.

## 10. Notes for whoever picks this up

The point of this project is that kids play it for free and the proceeds go to a children's
hospital. That sets the bar: if something is nearly right, it isn't done. When in doubt,
make it bigger, louder, friendlier and more forgiving than you think it needs to be.
