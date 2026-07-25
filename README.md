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
├── CLAUDE.md           # build brief for AI coding agents (read this first)
├── CONTRIBUTING.md
├── LICENSE             # MIT
├── reference/          # the original game, kept for porting reference
└── play/               # the game itself
    ├── index.html
    ├── css/
    ├── js/             # engine modules (scene, trains, world, modes, speech, gate, settings)
    └── assets/         # SVG art
```

### Status

🚧 **Phase 1 (Free Play) is in progress.** See `DESIGN.md` for the full roadmap and `CLAUDE.md` for the current build plan.

### The physical crossing gate (optional hardware)

The game can talk to a real gate over your local network via a tiny HTTP API:

| Request | Effect |
|---|---|
| `GET /open` | raise the gate |
| `GET /close` | lower the gate |
| `GET /status` | returns `{ "state": "up" \| "down" \| "raising" \| "lowering" }` |

The game polls `/status`, so pressing the **physical** button moves the on-screen gate, and on-screen actions move the hardware — two-way sync. Configure the device address in the game's settings (⚙️).

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md). New locations, translations, and art are especially appreciated.

## License

[MIT](LICENSE) — free to use, modify, and share.
