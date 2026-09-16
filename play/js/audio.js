/* audio.js — the crossing's voice: warning bell, whistle, chuff and car horn.

   Ported from reference/crossing_playtime.html, which already had the tuning
   right. The crossing's own sounds are all synthesised with Web Audio — no files
   to download, so the game stays a single folder you can open from disk.

   This module also OWNS THE SPEAKER for recorded narration: decode(), playClip()
   and stopClip() at the bottom, driven by speech.js. The clips are inlined into
   play/js/voice-*.js exactly as the scenes are inlined into asset-data.js, so
   file:// still works. They play on their own gain bus, not on master — the
   reason is written out above setEnabled(), and it is the reason ⚙️ Sound does
   not mute the narrator.

   Browsers refuse to make sound until the user has touched the page, so the
   AudioContext is created lazily by unlock(), which main.js calls on the first
   tap, click or key. Before that every call here is a silent no-op rather than
   an error.
*/
(function (CC) {
  'use strict';

  const STORAGE_KEY = 'cc.sound';
  let enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
  let ctx = null;
  let master = null;         // the crossing: bell, whistle, chuff, honk
  let voiceBus = null;       // the narrator — see WHY THE VOICE IS NOT ON master
  let bellTimer = null;
  let voiceNode = null;      // the one clip currently playing, so it can be cut

  /** The AudioContext is created ONLY from unlock(), which runs inside a real
      user gesture. Creating one anywhere else earns a console warning from the
      browser and a context that is suspended anyway, so everything below simply
      stays silent until the first tap. */
  function create() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = enabled ? 1 : 0;
      master.connect(ctx.destination);
      // Narration gets its OWN bus straight to the destination, bypassing
      // master. See the note above setEnabled().
      voiceBus = ctx.createGain();
      voiceBus.gain.value = 1;
      voiceBus.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  /** One shaped tone. Everything the crossing says is built from these. */
  function tone(opts) {
    const a = ctx;
    if (!a || !enabled) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.from, t);
    if (opts.to && opts.to !== opts.from) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || opts.len));
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack || 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.len);
    o.start(t);
    o.stop(t + opts.len + 0.02);
  }

  const audio = {
    get enabled() { return enabled; },

    /** Called on the first user gesture — the only moment a browser will let us
        start making sound. Safe to call as often as you like. */
    unlock() {
      const a = create();
      if (a && a.state === 'suspended') a.resume().catch(() => {});
    },

    /** WHY THE VOICE IS NOT ON master, and why ⚙️ Sound does not silence it.

        Hard rule #5: everything on screen is also SPOKEN. That is not a sound
        effect, it is how the game is read to a child who cannot read — turning
        it off leaves a three-year-old with unlabelled buttons.

        It also would have been a regression nobody asked for. While narration
        came from SpeechSynthesis it bypassed this module completely, so Sound
        off has always meant "no bell, still talks". Putting clips on master
        would have quietly changed that the day the recordings landed. So the
        toggle keeps meaning exactly what it has always meant, and the narrator
        keeps talking. A separate Voice switch can be added if it is ever
        wanted; the bus is already there to hang it on. */
    setEnabled(on) {
      enabled = !!on;
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
      if (master) master.gain.value = enabled ? 1 : 0;
      if (!enabled) this.stopBell();
      CC.emit && CC.emit('sound', enabled);
    },

    /* ---- recorded narration (speech.js drives this) ---------------------
       The clips arrive as ONE base64 MP3 per language plus an index of
       [start, duration] slices; see VOICE.md and tools/gen-voice.py. Playing
       them here rather than through an <audio> element reuses the gesture
       unlock the crossing sounds already need, and gives exact slicing:
       start(when, offset, duration) plays one word out of the sprite and
       stops dead at its end, which seeking an <audio> element does not. */

    /** True once a gesture has unlocked us and decoding is possible. */
    get ready() { return !!ctx; },

    /** Decode a sprite. Returns a Promise of an AudioBuffer, or null if we are
        not unlocked yet — the caller falls back to SpeechSynthesis, which is
        the right answer for any line spoken before the first tap. */
    decode(arrayBuffer) {
      if (!ctx) return null;
      // Safari's decodeAudioData only took the callback form for years, so ask
      // for a Promise and build one ourselves when we get undefined back.
      try {
        const p = ctx.decodeAudioData(arrayBuffer);
        if (p && typeof p.then === 'function') return p;
      } catch (e) { /* fall through to the callback form */ }
      return new Promise((res, rej) => {
        try { ctx.decodeAudioData(arrayBuffer, res, rej); } catch (e) { rej(e); }
      });
    },

    /** Play one slice of a decoded sprite. `onended` fires when it finishes OR
        when it is cut short by the next line, so speech.js's queue keeps
        draining either way. Returns false if it could not play at all. */
    playClip(buffer, offset, duration, onended) {
      if (!ctx || !buffer) return false;
      this.stopClip();
      try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(voiceBus);
        src.onended = () => { if (voiceNode === src) voiceNode = null; onended && onended(); };
        voiceNode = src;
        src.start(0, offset, duration);
        return true;
      } catch (e) { voiceNode = null; return false; }
    },

    /** Cut the current line — what speech.say({ interrupt: true }) needs.
        The onended handler is detached first so cancelling does not look like
        the line finishing and pull the next one off the queue. */
    stopClip() {
      if (!voiceNode) return;
      const n = voiceNode;
      voiceNode = null;
      try { n.onended = null; n.stop(); } catch (e) {}
    },

    /** The ding-ding-ding that runs the whole time the gate is not open. */
    startBell() {
      if (bellTimer || !enabled) return;
      const ding = () => tone({ type: 'sine', from: 880, gain: 0.28, len: 0.4 });
      ding();
      bellTimer = setInterval(ding, 460);
    },
    stopBell() { if (bellTimer) { clearInterval(bellTimer); bellTimer = null; } },

    whistle() { tone({ type: 'sawtooth', from: 400, to: 560, glide: 0.2, gain: 0.3, len: 1, attack: 0.05 }); },

    /** The bridge bell — deliberately LOWER and SLOWER than the crossing bell.
        Mystic is the first scene with two barriers that mean different things,
        and if they sound alike the distinction the artwork is drawing is undone
        the moment a child closes their eyes. One ding; the caller sets the pace. */
    bridgeDing() { tone({ type: 'sine', from: 392, gain: 0.16, len: 0.55, attack: 0.01 }); },
    chuff() { tone({ type: 'square', from: 95, gain: 0.14, len: 0.18 }); },
    honk() { tone({ type: 'square', from: 300, gain: 0.2, len: 0.25 }); },

    /** A soft blip for taps in the menus, so every press answers back. */
    blip() { tone({ type: 'triangle', from: 660, to: 880, glide: 0.08, gain: 0.12, len: 0.12 }); },
  };

  CC.audio = audio;
})(window.CC = window.CC || {});
