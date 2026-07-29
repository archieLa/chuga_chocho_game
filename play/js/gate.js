/* gate.js — the crossing-gate state machine + the link to a real crossing gate.

   THE GATE IS ALWAYS CONTROLLABLE — the two on-screen buttons, the spacebar, and
   the physical device, in every mode, on every screen. Nothing in this game ever
   disables it. See CLAUDE.md hard-rule #3.

   Ported from reference/crossing_playtime.html, including the one non-obvious
   bit: the device echoes back the state we just asked it for, and unless we
   recognise that echo it reads as "the physical button was pressed" and the two
   ends fight each other. The reference used a one-shot `gameInitiated` flag;
   this version remembers WHICH state it asked for (and forgets after two
   seconds), because a flag that is set and never consumed silently eats the
   next real press — which is exactly what happened the first time this was
   tested against a device.

   THE DEVICE, AND WHAT mDNS REALLY MEANS IN A BROWSER
   The gate advertises itself on the LAN as `crossinggate.local`. There is no
   JavaScript mDNS API — you cannot enumerate devices from a page. What works is
   using the `.local` hostname directly and letting the operating system resolve
   it via Bonjour. So "auto-connect" here means: quietly try
   http://crossinggate.local/status once at launch, and if it answers, remember it.

   Device HTTP API:  GET /open · GET /close · GET /status -> { state: up|down|raising|lowering }
*/
(function (CC) {
  'use strict';

  const STORAGE_KEY = 'cc.device';
  const PROBE_KEY = 'cc.deviceMissing';     // when the hopeful probe last failed
  const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_HOST = 'crossinggate.local';
  const POLL_MS = 180;
  const PROBE_TIMEOUT_MS = 2000;

  let state = 'open';                 // open | closing | closed | opening
  let angle = 0;                      // 0 = up, 90 = down (what the scene draws)
  let devAddr = localStorage.getItem(STORAGE_KEY) || '';
  let devPrev = 'up';
  let polling = false;
  let connected = false;
  let expected = null;                // the state WE last asked the device for
  let expectedAt = 0;

  // GitHub Pages is HTTPS, and a browser will not let an HTTPS page talk to
  // http://crossinggate.local. Nothing we can do about it from the page; the
  // settings panel says so in one plain sentence instead of failing silently.
  const blockedByHttps = location.protocol === 'https:';

  function base(addr) {
    const a = (addr == null ? devAddr : addr).trim();
    if (!a) return null;
    return (/^https?:\/\//.test(a) ? a : 'http://' + a).replace(/\/+$/, '');
  }

  /** fetch() with a timeout — a missing device must never hang the game. */
  function ask(url, ms) {
    if (blockedByHttps) return Promise.reject(new Error('https'));
    if (typeof AbortController === 'undefined') return fetch(url);
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms || PROBE_TIMEOUT_MS);
    return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
  }

  /** Tell the device to move, and remember what we asked for so its reply is
      recognised as our own echo rather than as someone pressing the button. */
  function command(ep) {
    expected = ep === '/close' ? 'down' : 'up';
    expectedAt = Date.now();
    const b = base();
    if (!b) return;
    ask(b + ep, 1200).catch(() => {});
  }

  /** Is this reported state just the device settling into what we asked for?
      Expires, so a command that never lands cannot block real presses forever. */
  function isOwnEcho(reported) {
    if (!expected) return false;
    if (Date.now() - expectedAt > 2000) { expected = null; return false; }
    if (reported === expected) { expected = null; return true; }
    return reported === (expected === 'down' ? 'lowering' : 'raising');
  }

  function setState(next, fromDevice) {
    state = next;
    CC.emit && CC.emit('gate', { state: state, fromDevice: !!fromDevice });
  }

  /** A state the device reported. Only act on changes the DEVICE started —
      somebody pressing the button on the real crossing gate. */
  function onDeviceState(reported) {
    if (!reported || reported === devPrev) { devPrev = reported || devPrev; return; }
    const prev = devPrev;
    devPrev = reported;
    if (isOwnEcho(reported)) return;
    const wentDown = (reported === 'down' || reported === 'lowering') && (prev === 'up' || prev === 'raising');
    const wentUp = (reported === 'up' || reported === 'raising') && (prev === 'down' || prev === 'lowering');
    if (wentDown) gate.close(true);
    if (wentUp) gate.open(true);
  }

  const gate = {
    get state() { return state; },
    get angle() { return angle; },
    isDown() { return state === 'closed' || state === 'closing'; },
    /** True the moment the gate starts to come down — that is when cars stop. */
    isBlocking() { return state !== 'open'; },

    close(fromDevice) {
      if (state === 'open' || state === 'opening') {
        setState('closing', fromDevice);
        if (!fromDevice) command('/close');
      }
    },
    open(fromDevice) {
      if (state === 'closed' || state === 'closing') {
        setState('opening', fromDevice);
        if (!fromDevice) command('/open');
      }
    },
    toggle() { this.isDown() ? this.open() : this.close(); },

    /** Advance the arm animation. dt is milliseconds; 0.22°/ms matches the
        reference game, which is about four-tenths of a second end to end. */
    tick(dt) {
      if (state === 'closing') {
        angle = Math.min(90, angle + dt * 0.22);
        if (angle >= 90) setState('closed');
      } else if (state === 'opening') {
        angle = Math.max(0, angle - dt * 0.22);
        if (angle <= 0) setState('open');
      }
    },

    // --- the physical device ------------------------------------------------
    get address() { return devAddr; },
    get connected() { return connected; },
    get httpsBlocked() { return blockedByHttps; },
    get defaultHost() { return DEFAULT_HOST; },

    setAddress(addr) {
      devAddr = (addr || '').trim();
      localStorage.setItem(STORAGE_KEY, devAddr);
      connected = false;
      if (devAddr) this.startPolling();
    },

    /** Ask a candidate address for its state. Resolves to the state or null. */
    probe(addr) {
      const b = base(addr);
      if (!b) return Promise.resolve(null);
      return ask(b + '/status', PROBE_TIMEOUT_MS)
        .then(r => r.json())
        .then(j => (j && j.state) || 'up')
        .catch(() => null);
    },

    /** Settings' Test button. Saves the address when it answers. */
    testDevice(addr) {
      const a = (addr || '').trim() || DEFAULT_HOST;
      return this.probe(a).then(st => {
        if (st) {
          devAddr = a;
          localStorage.setItem(STORAGE_KEY, devAddr);
          localStorage.removeItem(PROBE_KEY);
          devPrev = st;
          connected = true;
          this.startPolling();
        }
        return st;
      });
    },

    /** Called once at launch. If nothing is stored, quietly try the default
        hostname — in the normal case a parent never types anything. Failure is
        silent by design: no spinner, no popup, the game is simply unaffected.

        The SCREEN adopts the device's position rather than the other way round:
        a real arm swinging by itself the moment the game loads would be a
        surprise, and the physical thing in the room should win. */
    autoConnect() {
      if (blockedByHttps) return Promise.resolve(false);
      const candidate = devAddr || DEFAULT_HOST;
      // Looking for a gate that is not there costs a failed DNS lookup, and the
      // browser prints that in the console. Most people will never own the
      // hardware, so after one hopeful look we stop asking for a day. The Test
      // button in settings always tries again straight away.
      if (!devAddr) {
        const failedAt = parseInt(localStorage.getItem(PROBE_KEY) || '0', 10);
        if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return Promise.resolve(false);
      }
      return this.probe(candidate).then(st => {
        if (!st) {
          if (!devAddr) localStorage.setItem(PROBE_KEY, String(Date.now()));
          return false;
        }
        localStorage.removeItem(PROBE_KEY);
        devAddr = candidate;
        localStorage.setItem(STORAGE_KEY, devAddr);
        devPrev = st;
        connected = true;
        if (st === 'down' || st === 'lowering') this.close(true);
        else this.open(true);
        this.startPolling();
        CC.emit && CC.emit('device', { connected: true, address: devAddr });
        return true;
      });
    },

    /** Poll /status forever so the PHYSICAL button also drives the screen.
        Keeps running when the device drops out, so it reconnects on its own. */
    startPolling() {
      if (polling || blockedByHttps) return;
      polling = true;
      const tick = () => {
        const b = base();
        if (!b) { polling = false; return; }
        ask(b + '/status', 1200)
          .then(r => r.json())
          .then(j => {
            if (!connected) { connected = true; CC.emit && CC.emit('device', { connected: true, address: devAddr }); }
            onDeviceState(j && j.state);
          })
          .catch(() => {
            if (connected) { connected = false; CC.emit && CC.emit('device', { connected: false, address: devAddr }); }
          })
          .then(() => { if (polling) setTimeout(tick, POLL_MS); });
      };
      tick();
    },
  };

  CC.gate = gate;
})(window.CC = window.CC || {});
