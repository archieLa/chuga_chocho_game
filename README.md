# 🚂 Chuga Chocho

A free, open-source **train crossing game for young kids** (ages ~3–5). Press the button, the crossing gate lowers, and the train chugs through. Along the way it teaches **geography, counting, colors, and letters** — and it's spoken aloud in **English and Polish**.

It runs in any web browser, needs no install, and can even drive a **real physical crossing gate** if you build one.

> **▶ Play it online:** _(GitHub Pages link goes here once the repo is published, e.g. `https://<your-username>.github.io/chuga-chocho/`)_

---

## For parents & kids (no computer skills needed)

- **Play in your browser:** open the link above and tap **Play**. That's it.
- **Play offline at home:** click the green **Code** button on this page → **Download ZIP** → unzip it → open the `play/index.html` file by double-clicking. It works with no internet.

The game is gentle by design: there's **no way to lose** and nothing scary — just a happy train, big friendly buttons, and encouraging voices.

## What it teaches

- **Cause & effect** — press a button, something happens.
- **Geography** — travel the USA on a real map; each place changes the whole scene (Rocky Mountains, Chicago skyline, the Golden Gate Bridge, and more).
- **Trains** — steam, diesel, and electric engines you can recognize and recolor.
- **Early academics** *(coming in later versions)* — counting, colors, letters, and spelling as optional mini-games.

---

## For developers

Plain **HTML + CSS + JavaScript + SVG**. No framework, no build step required to run — just open `play/index.html`.

### Run locally

```bash
git clone https://github.com/<your-username>/chuga-chocho.git
cd chuga-chocho
# then either double-click play/index.html, or serve it:
python3 -m http.server 8000
# open http://localhost:8000/          → landing page
# open http://localhost:8000/play/     → the game
```

A local web server (like the `python3` one above) is recommended over `file://` so everything behaves exactly as it will on GitHub Pages.

### Project layout

```
chuga-chocho/
├── index.html          # public landing page ("website")
├── DESIGN.md           # full vision & roadmap — the source of truth
├── BUILD_PLAN.md       # the ordered Phase 1 work list + acceptance criteria
├── CLAUDE.md           # build brief for AI coding agents (read this first)
├── CONTRIBUTING.md
├── LICENSE             # MIT
├── SCENE_GUIDE.md      # how to author a location scene
├── reference/          # the original game, kept for porting reference
├── tools/              # asset generators + the two review galleries
│   ├── gen-scenes.py       # → play/assets/scenes/
│   ├── gen-trains.py       # → play/assets/trains/
│   ├── gen-map.js          # → play/assets/us-map.svg + play/js/map-data.js
│   ├── scene-gallery.html  # every location, trains running — open it from disk
│   └── train-gallery.html  # every locomotive and wagon — open it from disk
└── play/               # the game itself
    ├── index.html
    ├── css/
    ├── js/             # engine modules (scene, trains, world, modes, speech, gate, settings)
    └── assets/         # SVG art (scenes, trains, US map)
```

Want to see the art without running anything? Open `tools/scene-gallery.html` or
`tools/train-gallery.html` straight from disk — both are self-contained.

### Status

🎨 **All Phase 1 art is finished** — 8 locations, 14 locomotives and wagons, and the offline
US map are committed and final.

✅ **Phase 1 — Free Play is playable.** The game opens on the US map, all eight destinations
load with their preset train, both crossing gates lower together, road cars come from both
directions and queue at the gate, the child can build and colour their own train, and the
whole thing speaks English or Polish. It runs with no build step, offline, straight from
`play/index.html`.

Next up is Phase 2 — the mission modes (Count & Close, Letter Hunt, Picture Word).
`CLAUDE.md` holds the hard rules and art contracts; `DESIGN.md` has the full roadmap
through Phases 2 and 3; `BUILD_PLAN.md` records the Phase 1 work list and its checklist.

### The physical crossing gate (optional hardware)

The game can talk to a real gate over your local network via a tiny HTTP API:

| Request | Effect |
|---|---|
| `GET /open` | raise the gate |
| `GET /close` | lower the gate |
| `GET /status` | returns `{ "state": "up" \| "down" \| "raising" \| "lowering" }` |

The game polls `/status` about five times a second, so pressing the **physical** button moves
the on-screen gate, and on-screen actions move the hardware — two-way sync. The device
advertises itself as **`crossinggate.local`** and the game finds it automatically at launch;
you can also type a hostname or IP in settings (⚙️). When the game connects, the *screen*
adopts the position the real arm is already in, so nothing swings by itself when the game
loads.

**Two things the firmware must do:**

- **Send `Access-Control-Allow-Origin: *`** on `/status`. Without it a browser will let the
  game command the gate but never read its state back, and the physical button will appear
  to do nothing.
- **Report `state` honestly**, including `raising` / `lowering` while the arm is moving.

No hardware handy? `python3 tools/fake-gate.py 8099` is a stand-in that speaks the same API
(plus `/press`, which is the physical button) — put `127.0.0.1:8099` in settings.

> **Note:** browsers block an HTTPS page from talking to a plain-HTTP device on your LAN, so
> the physical gate works from the **downloaded copy** (open `play/index.html`, or serve it
> over `http://` on your home network) — not from the HTTPS website. The settings panel says
> so in plain words when it detects HTTPS. The on-screen game works everywhere either way.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md). New locations, translations, and art are especially appreciated.

## License

[MIT](LICENSE) — free to use, modify, and share.
