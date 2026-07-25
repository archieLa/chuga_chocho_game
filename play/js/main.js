/* main.js — the orchestrator. Sets up a tiny event bus, initializes every module,
   and wires the always-available gate controls (buttons + keyboard). Loaded last.

   Event bus: CC.on(name, fn) / CC.emit(name, payload). Modules stay decoupled —
   e.g. scene.js and audio react to the 'gate' event rather than calling each other.
*/
(function (CC) {
  'use strict';

  // --- minimal event bus ---
  const handlers = {};
  CC.on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
  CC.emit = (name, payload) => { (handlers[name] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); };

  function ready() {
    // Localize static labels and set up systems.
    CC.i18n.apply();
    CC.settings.init();
    CC.map.init();
    CC.scene.init();
    CC.modes.activate('freeplay');

    // Apply the current location's train preset (respects user overrides).
    const loc = CC.world.current;
    if (loc.trainPreset) CC.trains.applyPreset(loc.trainPreset);

    // When the location changes (via the map picker), apply its train preset.
    CC.on('location', (l) => { if (l && l.trainPreset) CC.trains.applyPreset(l.trainPreset); });

    // Always-on gate controls.
    const closeBtn = document.getElementById('closeBtn');
    const openBtn  = document.getElementById('openBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => { CC.gate.close(); CC.speech.say(CC.i18n.t('ui.close')); });
    if (openBtn)  openBtn.addEventListener('click',  () => { CC.gate.open();  CC.speech.say(CC.i18n.t('ui.open')); });
    document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); CC.gate.toggle(); } });

    // Re-localize when the language changes.
    CC.on('languagechange', () => CC.i18n.apply());

    // Start listening to a configured physical gate (two-way sync).
    CC.gate.startPolling();

    // TODO (Phase 1.5 / 1.6): wire mapBtn -> US map picker, trainBtn -> customizer.

    console.log('🚂 Chuga Chocho ready — language:', CC.i18n.code, '· location:', loc.id);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})(window.CC = window.CC || {});
