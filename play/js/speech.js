/* speech.js — spoken narration via the browser's built-in SpeechSynthesis.
   No audio files. Speaks in the active language (CC.i18n). See DESIGN.md §8.

   TWO THINGS THAT BITE, both handled here:

   1. Voices load asynchronously. getVoices() is empty on the first call in most
      browsers and fills in later, so we re-read the list on voiceschanged and
      pick the voice at the moment we speak, not before.

   2. A device may have no Polish voice at all. Degrading to silence would be
      the worst outcome — a child who hears nothing thinks the game is broken.
      So we fall back: an exact language match, then any voice of that language,
      then the default voice speaking the words anyway.

   PER-UTTERANCE LANGUAGE. Some place names stay in English even in Polish
   (world.js gives Polish forms only for Nowy Jork, Nowy Orlean, Wielki Kanion).
   "Rocky Mountains" read by a Polish voice is not recognisable, so callers can
   pass { lang: 'en' } and that one line is spoken by an English voice.
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

  const queue = [];
  let speaking = false;

  function drain() {
    if (!synth || !queue.length) { speaking = false; return; }
    speaking = true;
    const item = queue.shift();
    let u;
    try { u = new SpeechSynthesisUtterance(item.text); }
    catch (e) { speaking = false; return; }
    const lang = item.lang || (CC.i18n && CC.i18n.dict.voice) || 'en';
    const v = pickVoice(lang);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = lang; }
    u.rate = 0.92; u.pitch = 1.15;        // friendly, slightly higher, unhurried
    u.onend = drain;
    u.onerror = drain;                    // never let one failure stall the queue
    try { synth.speak(u); } catch (e) { speaking = false; }
  }

  const speech = {
    /** speech.say('Hello', { interrupt: true, lang: 'en' }) */
    say(text, opts) {
      if (!text || !synth) return;
      const o = opts || {};
      if (o.interrupt) { try { synth.cancel(); } catch (e) {} queue.length = 0; speaking = false; }
      queue.push({ text: String(text), lang: o.lang || null });
      if (!speaking) drain();
    },

    /** Speak a random praise word in the active language. */
    praise() {
      const list = (CC.i18n.dict && CC.i18n.dict.praise) || ['Yay!'];
      this.say(list[Math.floor(Math.random() * list.length)]);
    },

    cancel() {
      if (synth) { try { synth.cancel(); } catch (e) {} }
      queue.length = 0;
      speaking = false;
    },

    /** True when the device has a voice for the given language prefix. */
    hasVoice(langPrefix) { return !!pickVoice(langPrefix); },
  };

  CC.speech = speech;
})(window.CC = window.CC || {});
