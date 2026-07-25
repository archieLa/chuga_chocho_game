# Reference material

## `crossing_playtime.html`

The **original working game** — a single-file HTML5 canvas version. It's kept here
as a porting reference, not as part of the shipped game.

It already implements, and the new `play/` version should reuse the *logic* from:

- the gate **state machine** with eased open/close animation,
- **flashing crossing lights** and the **warning bell**,
- train **whistle**, **chug**, and car **honk** sounds (Web Audio API — no audio files),
- road **cars that stop** at a closed gate,
- and the **physical-device link**: polling `GET /status` for two-way sync so the
  physical button drives the on-screen gate and vice-versa (`/open`, `/close`).

Its **visuals are placeholder** (canvas rectangles). The new version replaces those
with layered SVG storybook art (see `DESIGN.md` §3), but the timing, audio, and
device logic here are proven — port them rather than reinventing.

> Note: the original UI text is Polish-first. The new version defaults to English
> with a Polish toggle (see `DESIGN.md` §8).
