# Build plan — hand this to a coding agent

> **Phase 1 (Free Play) is complete and playable.** Every box in §9 is ticked, with a note on
> how each one was actually checked. **If you are picking this project up now, your work list
> is §11 — Phase 2, the mission modes.** Sections 1–8 are the Phase 1 record: read them to
> understand why the engine is shaped the way it is before you change it.

**Goal: a playable game.** All the art was finished and committed before Phase 1 began; the
engine that puts it on screen and lets a three-year-old drive it now exists too.

Read `CLAUDE.md` (hard rules, art contracts, the module map and the verify loop) and
`SCENE_GUIDE.md` (scene geometry) first. This file is the ordered work list, the acceptance
criteria, and the loop to run.

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
| 27 location scenes | `play/assets/scenes/*.svg` | **Final.** 1280×720, horizon y=300, track band y=450–516, both gates at fixed coords. |
| 18 vehicles + manifest | `play/assets/trains/` | **Final.** Recolour hooks and wheel data baked in. |
| US map | `play/assets/us-map.svg`, `play/js/map-data.js` | **Final**, offline, picker wired in `map.js`. |
| Location data | `play/js/world.js` | 27 locations, each with `scene`, `say` (en/pl) and `trainPreset`. |
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

**Done when:** every location renders full-bleed, both gates lower together, the
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

**Done when:** picking any destination reskins the world, applies its preset engine
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
- [x] Every destination loads, looks right, and reskins the train to its preset.
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

---

## 11. Phase 2 — Game Mode (start here)

**`MODES.md` is the spec; this is the ordered work list built from it.** Where the two
differ, `MODES.md` wins — it carries the reasoning. `DESIGN.md` §11 has the original vision
and §14 has the kiosk deployment.

**What you are adding:** one optional **Game Mode**, a five-level maths ladder layered on
Free Play. Every level is the same verb — close the gate at the right moment. Free Play
stays the default and stays exactly as it is; Game Mode never becomes the only way to play.

**Two earlier plans are CUT: *Letter Hunt* and *Picture Word*.** Not primarily on cost —
they fail the gate test. "Close when you see the word TRAIN" is a flashcard app whose button
happens to look like a gate, whereas counting cars and closing is genuinely gate-shaped: the
thing counted is the thing going past, and the gate is what acts on it. `MODES.md` argues it
in full. Do not reinstate them without reading that section.

### The rules that do not change

1. **The gate is never disabled or gated behind a mission.** Both buttons, the spacebar and
   the physical device keep working at all times, in every mode, including mid-mission. A
   mission *interprets* the child's gate press; it must never *withhold* it.
2. **Nothing can be lost or failed.** A close at the "wrong" moment gets a warm "not yet —
   try the next one" and the mission carries on. No timers, no score to lose, no red X, no
   sad sound. Re-read hard rule #7 before designing any feedback.
3. **Every new string goes into BOTH dictionaries** in `i18n.js`, and everything on screen is
   also spoken. `numbers` and `praise` already exist there; `shapes` exists and is unused.
4. **Free Play remains the default mode** and is always one tap away. `modes.js` must still
   boot into `freeplay` when nothing is chosen.
5. Missions are **stateless across launches** unless you deliberately design otherwise —
   nothing in a mission should feel like homework a child left unfinished.

### The engine hooks you already have

`CC.on(name, fn)` / `CC.emit(name, payload)`, from `main.js`:

| Event | Payload | Emitted by |
|---|---|---|
| `gate` | `{ state, fromDevice }` — `open`/`closing`/`closed`/`opening` | `gate.js` |
| `carpassed` | the running count (a number) | `scene.js` |
| `location` | the location object | `world.js` |
| `train` | the whole consist | `trains.js` |
| `device` | `{ connected, address }` | `gate.js` |
| `mode` | the mode id | `modes.js` |
| `languagechange` | the language code | `i18n.js` |
| `settings` | the settings object | `settings.js` |
| `sound` | `true`/`false` — the crossing-audio mute, **not** the narrator | `audio.js` |

`CC.modes` is a registry with `register(id, mode)`, `activate(id)`, `list()` and `active`; a
mode is `{ id, start(), stop() }`. Only `freeplay` is registered today. `CC.scene.resetCounter()`
exists. `CC.speech.say(text, { interrupt, lang })` and `CC.speech.praise()` are there.

### I. Engine hooks the missions need (do this first — it is small)

Count & Close needs to know *which car* passed, and needs the car's colour to be
**nameable**, and neither is true yet.

- `scene.js` emits `carpassed` with only a running count. Widen the payload to
  `{ count, colour, key, dir }` — keep `count` so the existing counter in `main.js` keeps
  working, and note that `main.js` currently does `CC.on('carpassed', n => refreshCounter(n))`,
  so it must be updated in the same commit.
- `CAR_COLOURS` in `scene.js` is seven raw hexes that do not line up with anything nameable:
  they differ from `CC.trains.PALETTE`, and one of them (`#e8e8ee`, white) has no name in
  `i18n.js` `colors` at all. Rework the car palette into `{ key, hex }` entries whose `key`
  exists in `i18n` `colors`, so a mission can say "two red cars" in either language. Either
  drop white or add `white` to both dictionaries — don't leave an unnameable car in a mode
  whose whole job is naming colours.
- **Done when:** a mission can subscribe to `carpassed` and speak the colour of the car that
  just went by, in English and Polish, and the existing car counter still counts correctly.
### J. The Game Mode framework

`MODES.md` is the spec for all of J–N. Where this list and that document differ,
**that document wins** — it carries the reasoning.

- **The mode toggle goes in ⚙️ Settings, NOT the topbar.** The topbar is already
  🗺️ 🚆 ⚙️ and a fourth button is tight on a phone held sideways; and it makes the
  mode a grown-up's choice so a child cannot fumble himself into a test. Turning
  Game Mode on **reveals a level row beneath it** (progressive disclosure — Free
  Play users never see a difficulty setting).
- `settings.js` already has a `row(label, fill)` helper and `.set-scroll` already
  scrolls, so two new rows need no layout work.
- A **prompt banner** in the scene, top-centre, clear of the topbar and the gate
  buttons. Always spoken as well as shown. **Size it to be readable by a parent
  standing behind the child** — that is the conversion moment in a museum, and it
  costs nothing at home.
- Mission lifecycle in `modes.js`: `start()` subscribes, `stop()` unsubscribes
  **and clears the banner**. Switching modes must not leak listeners — the
  one-entry registry never had to care, so check it deliberately.
- **No-fail feedback**, one shared helper: right answer → `CC.speech.praise()` +
  a happy sound; not-yet → a gentle spoken nudge, and the task continues
  unchanged.
- **Done when:** Game Mode can be switched on and off in ⚙️, its prompt is shown
  and spoken in both languages, the gate works throughout, and switching modes
  ten times leaves no duplicate listeners and no stale banner.

### K. The task engine — one shape for all five levels

A target is a list of `{ colour, count }`. Levels 4–5 only decide `count` by an
equation and then run level 1 underneath. Build this once:

| level | target | new thing |
|---|---|---|
| 1 | `[{colour:null, count:N}]` | counting |
| 2 | `[{colour:'red', count:N}]` | a filter |
| 3 | `[{colour:'red',count:2},{colour:'blue',count:3}]` | two counters |
| 4 | `2 + 3 = 5` → count 5 | numerals, sum made concrete |
| 5 | `2 + 3 = ?` → count the answer | computing it |

- Subscribe to `carpassed` (`{ count, colour, key, dir }` — task I, done).
- **Progress shows as countable objects, not a numeral.** The pips do the
  cardinality for a child who cannot yet hold "I have seen five" as a state.
  This is the mechanism, not decoration.
- **Targets are drawn from a BAG, not `Math.random()`** — same reasoning as
  `world.drawRandom()`. The pool widens with success (`{2,3}` → `{2,3,4,5}`) and
  **never narrows**.
- **Level 2+ must bias the car spawn toward the target colour** (~1 in 3, not 1
  in 7). Measured: cars arrive on a global 1.5s timer (~36/min in every scene),
  so one colour comes every ~11s and "five red cars" is **57 seconds** of
  watching cars that do not count. That is tedium, which a small child reads as
  the game being broken. **The bias stops dead in Free Play.**
- **Level 5 needs the rescue:** after ~15s the answer quietly completes itself
  and level 5 becomes level 4. Nothing marks it as a failure.
- **Done when:** every level sets varying targets, speaks and shows them in both
  languages, praises on success, nudges gently on a miss, and nothing can be lost.

### L. Claiming — the flag on the map

- A completed state flies a **US flag**. `cc.claimed` is **keyed by level**:
  `{ "1": [ids], "2": [ids] }`. The map shows the current level's flags.
- **BLOCKER, do this first:** map labels carry no `data-name`. Add it to the
  `<text class="lbl">` in `tools/gen-map.js` and re-run — the flag anchors to the
  **label**, not the state shape, because DC is 3×4px and nine states live in the
  margin `COLUMN`. The column needs its own placement; a naive offset collides
  with the Massachusetts label.
- **Do not borrow `.cc-livery` or `data-livery`** — reserved for rolling stock.
  Use `.state-flag`. (The Medora-surrey rule.)
- Gold is taken: `#ffd166` is `.state--picked`. Draw the flag as an **overlay**
  so it composes with a picked state — which is the common case, since you are
  standing in a state when you earn it.
- Specificity: write `#us-map .state.state--claimed`, per `styles.css:253`.
- **Second visits ALWAYS set a task**, flag or no flag. Never "you have this one
  already".
- **Nothing is ever unlocked and no claimed-count is shown** beyond the mode chip.
- **Done when:** completing a task plants a flag, it survives a reload, changing
  level shows a different board, and a revisit still sets a task.

### M. Celebrations

- **Per state: the train comes.** Immediately, with the whistle, plus
  `CC.speech.praise()`. The celebration is the game working, not a cutscene —
  a train arriving because you operated the crossing correctly is the whole
  thesis in one beat. `audio.js` already has every sound needed.
- The flag plants itself **in the scene**, on a pole by the crossing, so the
  reward happens where he is; the map is where he finds it later.
- **Whole map: warm, not fireworks.** Flags ripple across the country, the train
  runs over the map, praise in his language. Then nothing is opened and nothing
  is taken.
- **Done when:** both celebrations play in both languages and neither blocks the
  gate.

### N. Protection and polish

- **Hold-to-confirm (3s)** on the two controls that can empty a board: the level
  switch, and "Start this level again" (current level only). `⚙️ reset train` is
  NOT the precedent — it fires with no confirmation (`settings.js:149`), fine for
  a train, wrong for forty flags.
- The level row's text must say plainly: *"Level 2 starts a fresh map. Level 1's
  flags are kept."*
- Re-check the whole journey with `tools/shot.py` over `file://` **and**
  `http://`, screenshot every level, confirm zero console errors or warnings.

### Phase 2 definition of done

- [ ] Free Play is untouched and remains the default.
- [ ] Game Mode toggles in ⚙️, and the level row appears with it.
- [ ] All five levels set varying targets and are shown **and** spoken, EN and PL.
- [ ] The gate works from buttons, spacebar and the physical device in every mode.
- [ ] A wrong answer is never punished — no fail state, no timer, no scary feedback.
- [ ] Switching modes repeatedly leaks no listeners and leaves no stale banner.
- [ ] Flags persist per level; changing level never destroys another level's board.
- [ ] Nothing in the game is locked behind an achievement.
- [ ] Zero console errors or warnings, `file://` and `http://`, every level.
- [ ] A three-year-old can still get from launch to a moving train without help.

---

## 12. Known issues

### 12.1 Scenes cropped in portrait — RESOLVED, landscape-everywhere + rotate prompt

**Status: fixed.** Kept here because the measurements are the reason for the design, and
the next person will otherwise re-derive them.

**It was never skew.** That is what it looks like, but nothing is distorted — the aspect
ratio is preserved exactly. The scene SVG is a fixed **1280×720 (1.78)** mounted with
`preserveAspectRatio="xMidYMid slice"`, which scales to *cover* and crops the overflow. A
phone held upright is about **0.46**, so the art was cropped to a narrow central strip:

| Viewport | Aspect | Art width visible |
|---|---|---|
| **844×390 phone LANDSCAPE** | 2.16 | **100%** (crops 18% of height — sky and grass) |
| 1280×800 desktop | 1.60 | **90%** |
| 1024×768 tablet landscape | 1.33 | **75%** |
| 768×1024 tablet **portrait** | 0.75 | **42%** |
| 390×844 phone portrait | 0.46 | **26%** |

**The top row is the whole answer.** A phone on its side is the *best* fit of any device —
better than a laptop — so the problem was never the phone, it was portrait, and portrait is
bad on tablets too. The game is therefore **landscape on every device**, and portrait shows
`#rotate`: a tipping-device picture with a spoken "Turn me sideways!", driven by a pure CSS
`max-aspect-ratio: 115/100` media query so it appears and clears the instant the device
turns, with no resize handler to drift out of step. Tablet landscape (1.33) and phone
landscape (2.16) both stay clear of the threshold.

`#rotate` sits above the gate buttons: in portrait the crossing is unreadable, so there is
nothing meaningful to press. `CC.gate` keeps running underneath — spacebar and a real LAN
gate are unaffected — and the buttons return the moment the device turns.

The `#title` / `#topbar` overlap seen at phone width needed no fix: it only ever happened in
portrait, and an existing `max-height:520px` rule already hides the title on short screens.

**Why it mattered more than it sounds.** What survived the crop was the road and the
crossing — identical in every location. Everything that makes a place *that place*
lives out to the sides: Miami Beach in portrait lost the Atlantic, the beach, the
lifeguard towers and most of the Deco row. The geography teaching was the first thing
the crop took.

**Checked on a real iPhone, and one of the two predicted problems was real.**
Everything above was reproduced by rendering at those viewport sizes in headless Chrome,
which does not cover iOS Safari's own behaviour. On the device:

- **The dynamic toolbar did cut the page off.** `100vh` on iOS is the height with the
  toolbar HIDDEN, so a `100vh` page is taller than what is actually on screen and its foot
  slides underneath the chrome — the bottom of every scene and part of the CLOSE/OPEN
  buttons. Fixed by giving `html`, `body` and `#wrap` `100dvh`, which tracks the viewport
  that is really there, with the old `100vh` line kept first as the pre-iOS-15.4 fallback.
- **Safe-area insets were fine** — nothing was clipped by the notch in landscape. The gate
  buttons still add `env(safe-area-inset-bottom)` anyway, because they sit lowest and the
  gate is the one control that must never be unreachable. It resolves to 0px everywhere
  without an inset, so it costs other devices nothing.

Headless Chrome cannot see either of these, so **anything about viewport height has to be
checked on the device**; the shot.py loop will happily report a clean pass.
