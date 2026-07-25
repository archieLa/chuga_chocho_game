/* speech.js — spoken narration via the browser's built-in SpeechSynthesis.
   No audio files. Speaks in the active language (CC.i18n). See DESIGN.md §8.

   TODO (Phase 1): voice preference/quality per platform; graceful fallback when
   a language has no installed voice (see CLAUDE.md open decision #5).
*/
(function (CC) {
  'use strict';

  const synth = window.speechSynthesis;
  let voices = [];
  function loadVoices() { voices = synth ? synth.getVoices() : []; }
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }

  function pickVoice(langPrefix) {
    return voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix)) || null;
  }

  const queue = [];
  let speaking = false;

  function drain() {
    if (!queue.length) { speaking = false; return; }
    speaking = true;
    const text = queue.shift();
    if (!synth) { speaking = false; return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (CC.i18n && CC.i18n.dict.voice) || 'en';
    const v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.rate = 0.95; u.pitch = 1.15;      // friendly, slightly higher for kids
    u.onend = drain; u.onerror = drain;
    synth.speak(u);
  }

  const speech = {
    /** Speak text. {interrupt:true} cancels anything in progress first. */
    say(text, opts) {
      if (!text) return;
      if (opts && opts.interrupt && synth) { synth.cancel(); queue.length = 0; speaking = false; }
      queue.push(String(text));
      if (!speaking) drain();
    },
    /** Speak a random praise word in the active language. */
    praise() {
      const list = CC.i18n.dict.praise || ['Yay!'];
      this.say(list[Math.floor(Math.random() * list.length)]);
    },
    cancel() { if (synth) synth.cancel(); queue.length = 0; speaking = false; },
  };

  CC.speech = speech;
})(window.CC = window.CC || {});
