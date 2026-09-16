/* speech.js — spoken narration. RECORDED clips first, the browser's
   SpeechSynthesis as the safety net. Speaks in the active language (CC.i18n).
   See DESIGN.md §8 and VOICE.md.

   WHY THERE ARE RECORDINGS AT ALL
      SpeechSynthesis is a different voice on every browser and platform, none of
      them sound like they are talking to a three-year-old, and the ones that get
      "Albuquerque" or "Oʻahu" wrong get them wrong confidently. So every line the
      game can say is recorded offline with Piper and inlined into voice-en.js /
      voice-pl.js by tools/gen-voice.py.

   THE CLIPS ARE KEYED BY THE TEXT ITSELF, not by an id. say() keeps exactly the
      signature it always had and no call site knows the recordings exist — the
      key is the line, normalised (NFC, collapsed whitespace, lowercased) by
      key() below, matching tools/voice-lines.js exactly. Change that rule in one
      place and you must change it in both.

      The corollary, and the one real rule for callers: NEVER hand say() a string
      you built by concatenation. It will be in no dictionary, so it gets no clip
      and silently drops to the robot for ever. Say the atoms in sequence —
      customizer.js's saySlot() and map.js's surprise reveal both do this.

   SILENCE IS NEVER AN OPTION (decision #5). A child who hears nothing thinks the
      game is broken. So every failure here degrades rather than stops: no clip →
      SpeechSynthesis; no voice for the language → any voice saying the words
      anyway; a decode that fails → the robot for the rest of the session.

   PER-UTTERANCE LANGUAGE. say() takes { lang } to speak one line in a language
      other than the active one, and it still works. Nothing in the game uses it
      now: the narrator no longer changes mid-session, because hearing "Następny
      przystanek" in one woman's voice and "Wisconsin Dells" in another's is far
      more jarring to a three-year-old than an approximate vowel. Every place and
      state is recorded in BOTH sprites and the active language says all of it.
      See world.spoken() for the full reasoning — it reverses half of decision #6.
      The hook stays because it costs nothing and is the natural way to add a
      line that genuinely must be said in another language.

   TWO SPEECHSYNTHESIS THINGS THAT BITE, both still handled below:
      1. Voices load asynchronously — getVoices() is empty on the first call in
         most browsers — so the voice is picked at the moment we speak.
      2. A device may have no Polish voice at all; we fall back rather than
         going quiet.
*/
(function (CC) {
  'use strict';

  const synth = window.speechSynthesis || null;
  let voices = [];

  function loadVoices() { voices = synth ? synth.getVoices() : []; }
  if (synth) {
    loadVoices();
    if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', loadVoices);
  }

  function pickVoice(langPrefix) {
    if (!voices.length) loadVoices();
    const p = (langPrefix || 'en').toLowerCase();
    const matches = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(p));
    if (!matches.length) return null;
    // Prefer a local (offline) voice — they start instantly and work with no network.
    return matches.find(v => v.localService) || matches[0];
  }

  /* ---- the recorded sprites ------------------------------------------- */

  // lang -> { buffer } once decoded, or { failed: true } once we have given up.
  const decoded = {};
  const decoding = {};

  /** The lookup key for a line. MUST match tools/voice-lines.js keyOf(). */
  function key(text) {
    return String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function base64ToBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /** Decode a language's sprite, once. Returns a Promise of an AudioBuffer, or
      null when we cannot even start — before the first tap there is no
      AudioContext, and that is the normal case, not an error. */
  function sprite(lang) {
    if (decoded[lang]) return decoded[lang].failed ? null : Promise.resolve(decoded[lang].buffer);
    if (decoding[lang]) return decoding[lang];
    const data = CC.voice && CC.voice[lang];
    if (!data || !data.mp3 || !CC.audio || !CC.audio.ready) return null;

    let p;
    try { p = CC.audio.decode(base64ToBuffer(data.mp3)); }
    catch (e) { p = null; }
    if (!p) { return null; }

    decoding[lang] = p.then(buf => {
      decoded[lang] = { buffer: buf };
      delete decoding[lang];
      return buf;
    }).catch(e => {
      // One failed decode means this sprite is unusable; stop retrying it every
      // line and let the robot carry the session.
      console.warn('speech: could not decode the ' + lang + ' voice, using SpeechSynthesis', e);
      decoded[lang] = { failed: true };
      delete decoding[lang];
      return null;
    });
    return decoding[lang];
  }

  /** The [start, duration] slice for a line, or null if it was never recorded. */
  function slice(lang, text) {
    const data = CC.voice && CC.voice[lang];
    if (!data || !data.index) return null;
    return data.index[key(text)] || null;
  }

  /* ---- the queue ------------------------------------------------------- */

  const queue = [];
  let speaking = false;
  let token = 0;            // bumped by cancel(), so a slow decode cannot
                            // resurrect a line the child has already moved past

  function robot(item, done) {
    if (!synth) { done(); return; }
    let u;
    try { u = new SpeechSynthesisUtterance(item.text); }
    catch (e) { done(); return; }
    const v = pickVoice(item.lang);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = item.lang; }
    u.rate = 0.92; u.pitch = 1.15;        // friendly, slightly higher, unhurried
    u.onend = done;
    u.onerror = done;                     // never let one failure stall the queue
    try { synth.speak(u); } catch (e) { done(); }
  }

  function drain() {
    if (!queue.length) { speaking = false; return; }
    speaking = true;
    const item = queue.shift();
    const mine = token;
    const next = () => { if (mine === token) drain(); };

    const sl = slice(item.lang, item.text);
    if (!sl) { robot(item, next); return; }

    const ready = sprite(item.lang);
    if (!ready) { robot(item, next); return; }   // not unlocked yet, or no context

    // A clip exists and the sprite is on its way. WAIT for it rather than
    // timing out into the robot: the only line this can delay is the welcome,
    // spoken on the very tap that unlocks audio, and a beat of silence there is
    // better than the one line of the session sounding like a different game.
    ready.then(buf => {
      if (mine !== token) return;                // cancelled while decoding
      if (!buf || !CC.audio.playClip(buf, sl[0], sl[1], next)) robot(item, next);
    });
  }

  const speech = {
    /** speech.say('Hello', { interrupt: true, lang: 'en' }) */
    say(text, opts) {
      if (!text) return;
      const o = opts || {};
      const lang = o.lang || (CC.i18n && CC.i18n.dict.voice) || 'en';
      if (o.interrupt) this.cancel();
      queue.push({ text: String(text), lang: lang });
      if (!speaking) drain();
    },

    /** Speak a random praise word in the active language. */
    praise() {
      const list = (CC.i18n.dict && CC.i18n.dict.praise) || ['Yay!'];
      this.say(list[Math.floor(Math.random() * list.length)]);
    },

    cancel() {
      token++;
      if (synth) { try { synth.cancel(); } catch (e) {} }
      if (CC.audio && CC.audio.stopClip) CC.audio.stopClip();
      queue.length = 0;
      speaking = false;
    },

    /** True when the device has a voice for the given language prefix.
        A recorded sprite counts — it is a better voice than any of them. */
    hasVoice(langPrefix) {
      const v = CC.voice && CC.voice[langPrefix];
      return !!(v && v.index) || !!pickVoice(langPrefix);
    },

    /** Is this line recorded? tools/check-voice.py proves the answer is yes for
        every line in the dictionaries; this is for debugging in the console. */
    hasClip(text, lang) { return !!slice(lang || (CC.i18n && CC.i18n.code) || 'en', text); },
  };

  CC.speech = speech;
})(window.CC = window.CC || {});
