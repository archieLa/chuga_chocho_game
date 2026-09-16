#!/usr/bin/env node
/* voice-lines.js — every line the game can SPEAK, as JSON on stdout.
 *
 * THE ONE SOURCE OF TRUTH for the voice pipeline. Both tools/gen-voice.py (which
 * records the lines) and tools/check-voice.py (which proves the recordings match)
 * read this and nothing else, so they can never disagree about the line list.
 *
 * WHY NODE AND NOT PYTHON
 *   It loads the REAL play/js/i18n.js and play/js/world.js and calls the real
 *   world.spoken(). A Python regex over those files would be a second, drifting
 *   implementation of the language rules — and the language rules are the subtle
 *   part (see below). This way a change to world.spoken() cannot leave the
 *   recordings behind.
 *
 * THE KEY IS THE TEXT (VOICE.md). Normalised: NFC, lowercased, whitespace
 *   collapsed. So "CLOSE" and "Close" share one clip, which is what you want,
 *   and no separate slug table can ever go stale. Keys live in a per-language
 *   index, so English "wagon" and a hypothetical Polish "wagon" never collide.
 *
 * THE LANGUAGE OF A LINE IS NOT THE DICTIONARY IT CAME FROM. 44 of the 55 place
 *   names have no Polish form and are spoken by an ENGLISH voice even in Polish
 *   (decision #6: "Rocky Mountains" with Polish phonetics is not recognisable),
 *   and state names are always English. world.spoken() / world.spokenState()
 *   already decide this; we just record what they say.
 *
 * WHAT GETS RECORDED: every string in ui, colors, numbers, shapes, vehicles and
 *   praise, plus welcome.sayAs and the language's own name — wholesale, not the
 *   subset that reaches speech.say() today. A per-key judgement about "is this
 *   one spoken?" is exactly the kind of list that rots, and being wrong the
 *   quiet way means a child hears the robot. A handful of never-spoken settings
 *   hints cost a few seconds of audio; that is the cheaper mistake. `numbers`
 *   and `shapes` are here for the Phase 2 modes for the same reason — recording
 *   them now means not doing this again with a different voice.
 *
 * NEVER CONCATENATE A SPOKEN STRING. A line built at a call site (rather than
 *   read from a dictionary) cannot appear here, so it gets no clip and silently
 *   drops to the robot for ever. customizer.js's saySlot() shows the fix: say
 *   the atoms in sequence. This tool cannot detect that mistake — the code
 *   review has to.
 *
 * USAGE  node tools/voice-lines.js            # JSON
 *        node tools/voice-lines.js --summary  # human-readable counts
 */
'use strict';
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', 'play', 'js');

// --- load the real modules in a browser-shaped stub ------------------------
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.document = { documentElement: {}, querySelectorAll: () => [] };
global.window = { CC: {} };
// i18n.js keeps DICT private, as it should. Reach in once, here, rather than
// making the module export its internals for a build tool's benefit.
eval(fs.readFileSync(path.join(JS, 'i18n.js'), 'utf8')
       .replace('  CC.i18n = i18n;', '  CC.i18n = i18n; global.__DICT = DICT;'));
eval(fs.readFileSync(path.join(JS, 'world.js'), 'utf8'));
const CC = global.window.CC;
const DICT = global.__DICT;

const SECTIONS = ['ui', 'colors', 'numbers', 'shapes', 'vehicles', 'praise'];

/** The lookup key for a line. speech.js computes this the same way. */
function keyOf(text) {
  return String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

const lines = new Map();          // lang -> Map(key -> {key, text, lang, sources[]})
function add(lang, text, source) {
  if (!text || !String(text).trim()) return;
  if (!lines.has(lang)) lines.set(lang, new Map());
  const m = lines.get(lang);
  const k = keyOf(text);
  if (m.has(k)) { m.get(k).sources.push(source); return; }
  m.set(k, { key: k, text: String(text).normalize('NFC').replace(/\s+/g, ' ').trim(),
             lang: lang, sources: [source] });
}

// --- the dictionaries ------------------------------------------------------
for (const lang of Object.keys(DICT)) {
  const d = DICT[lang];
  for (const sec of SECTIONS) {
    const walk = (v, p) => {
      if (typeof v === 'string') return add(lang, v, p);
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, p + '[' + i + ']'));
      if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], p + '.' + k));
    };
    if (d[sec]) walk(d[sec], 'i18n.' + lang + '.' + sec);
  }
  // `sayAs` and not `text`: sayAs is the RESPELLING the voice is given, so it is
  // what reaches speech.say() and therefore what has to be recorded. The brand
  // sound is spelled for this language's phonetics ("czuga czuga czu czu"), and
  // Piper wants exactly that spelling too. Same split i18n makes for the screen.
  if (d.welcome) add(lang, d.welcome.sayAs || d.welcome.text, 'i18n.' + lang + '.welcome.sayAs');
  // Spoken by settings.js when you switch language — in the language you chose.
  if (d.name) add(lang, d.name, 'i18n.' + lang + '.name');
}

// --- places and states, via the real language rules ------------------------
const locs = CC.world.all();
for (const loc of locs) {
  for (const lang of Object.keys(DICT)) {
    const s = CC.world.spoken(loc, lang);          // {text, lang} — lang may be 'en'
    add(s.lang, s.text, 'world.' + loc.id + '.say.' + lang);
  }
  const st = CC.world.spokenState(loc);            // always English
  if (st) add(st.lang, st.text, 'world.' + loc.id + '.state');
}
// map.js also speaks a bare state name when a state is tapped; every one of
// those is already covered by spokenState above, but assert it rather than
// assume — a state with a scene whose place name IS the state (stateIsPlace)
// returns null there, and its name is still spoken on the map.
for (const loc of locs) if (loc.state) add('en', loc.state, 'map.state.' + loc.state);

// --- out -------------------------------------------------------------------
const out = {};
for (const [lang, m] of lines) out[lang] = [...m.values()].sort((a, b) => a.key < b.key ? -1 : 1);

if (process.argv.includes('--summary')) {
  let total = 0, chars = 0;
  for (const lang of Object.keys(out).sort()) {
    const c = out[lang].reduce((n, l) => n + l.text.length, 0);
    console.log(`  ${lang}: ${String(out[lang].length).padStart(4)} lines, ${String(c).padStart(5)} chars  (~${Math.round(c / 12)}s)`);
    total += out[lang].length; chars += c;
  }
  console.log(`  total: ${total} lines, ~${Math.round(chars / 12)}s of audio`);
} else {
  process.stdout.write(JSON.stringify(out, null, 1));
}
