/* audio.js — the crossing's voice: warning bell, whistle, chuff and car horn.

   Ported from reference/crossing_playtime.html, which already had the tuning
   right. Everything is synthesised with Web Audio — no files to download, so the
   game stays a single folder you can open from disk.

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
  let master = null;
  let bellTimer = null;

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

    setEnabled(on) {
      enabled = !!on;
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
      if (master) master.gain.value = enabled ? 1 : 0;
      if (!enabled) this.stopBell();
      CC.emit && CC.emit('sound', enabled);
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
    chuff() { tone({ type: 'square', from: 95, gain: 0.14, len: 0.18 }); },
    honk() { tone({ type: 'square', from: 300, gain: 0.2, len: 0.25 }); },

    /** A soft blip for taps in the menus, so every press answers back. */
    blip() { tone({ type: 'triangle', from: 660, to: 880, glide: 0.08, gain: 0.12, len: 0.12 }); },
  };

  CC.audio = audio;
})(window.CC = window.CC || {});
