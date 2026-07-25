/* gate.js — the crossing-gate state machine + physical device link.
   THE GATE IS ALWAYS CONTROLLABLE (buttons AND physical endpoint), in every mode.
   See DESIGN.md §9 and CLAUDE.md hard-rule #3.

   Port the proven animation + audio + two-way-sync logic from
   reference/crossing_playtime.html. This stub defines the interface so the rest
   of the game can wire to it now.

   Physical device HTTP API:
     GET /open  · GET /close · GET /status -> { state: up|down|raising|lowering }
*/
(function (CC) {
  'use strict';

  const STORAGE_KEY = 'cc.device';
  let state = 'open';                 // open | closing | closed | opening
  let angle = 0;                      // 0 = up, 90 = down (for rendering)
  let devAddr = localStorage.getItem(STORAGE_KEY) || '';

  function base() {
    if (!devAddr) return null;
    return (devAddr.startsWith('http') ? devAddr : 'http://' + devAddr).replace(/\/+$/, '');
  }
  function devSend(ep) { const b = base(); if (b) fetch(b + ep).catch(() => {}); }

  const gate = {
    get state() { return state; },
    get angle() { return angle; },
    isDown() { return state === 'closed' || state === 'closing'; },

    close(fromDevice) {
      if (state === 'open' || state === 'opening') {
        state = 'closing';
        CC.emit && CC.emit('gate', { state, fromDevice: !!fromDevice });
        if (!fromDevice) devSend('/close');
      }
    },
    open(fromDevice) {
      if (state === 'closed' || state === 'closing') {
        state = 'opening';
        CC.emit && CC.emit('gate', { state, fromDevice: !!fromDevice });
        if (!fromDevice) devSend('/open');
      }
    },
    toggle() { this.isDown() ? this.open() : this.close(); },

    /** Advance the animation each frame; call from the render loop. */
    tick(dt) {
      if (state === 'closing') { angle = Math.min(90, angle + dt * 0.22); if (angle >= 90) { state = 'closed'; CC.emit && CC.emit('gate', { state }); } }
      else if (state === 'opening') { angle = Math.max(0, angle - dt * 0.22); if (angle <= 0) { state = 'open'; CC.emit && CC.emit('gate', { state }); } }
    },

    // --- physical device config + polling (two-way sync) ---
    get address() { return devAddr; },
    setAddress(addr) { devAddr = (addr || '').trim(); localStorage.setItem(STORAGE_KEY, devAddr); },
    async testDevice() { const b = base(); if (!b) return null; try { const r = await fetch(b + '/status'); return await r.json(); } catch (e) { return null; } },

    startPolling() {
      // TODO (Phase 1.1): port polling from reference game. Poll /status; when the
      // DEVICE initiates a change (physical button), drive close(true)/open(true).
    },
  };

  CC.gate = gate;
})(window.CC = window.CC || {});
