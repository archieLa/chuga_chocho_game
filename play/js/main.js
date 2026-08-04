/* main.js — the orchestrator. Sets up a tiny event bus, starts every module,
   and wires the always-available gate controls. Loaded last.

   Event bus: CC.on(name, fn) / CC.emit(name, payload). Modules stay decoupled —
   scene.js and audio.js react to the 'gate' event rather than calling each other.

   THE FIRST TOUCH. Browsers refuse to speak or make a sound until the user has
   touched the page, so the welcome is armed here and fires on the first tap,
   click or key anywhere — once per launch, exactly like unlock() in the
   reference game. Waiting for that gesture is also when the audio context is
   created.
*/
(function (CC) {
  'use strict';

  // --- minimal event bus ---
  const handlers = {};
  CC.on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
  CC.emit = (name, payload) => {
    (handlers[name] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  };

  let welcomed = false;

  function firstTouch() {
    CC.audio.unlock();
    if (welcomed) return;
    welcomed = true;
    CC.speech.say(CC.i18n.t('welcome.sayAs'), { interrupt: true });
  }

  function counterEl() { return document.getElementById('counter'); }

  function refreshCounter(n) {
    const el = counterEl();
    if (!el) return;
    const show = CC.settings.config.showCounter;
    el.hidden = !show;
    el.textContent = '🚗 ' + (n == null ? CC.scene.carsPassed : n);
  }

  function ready() {
    CC.i18n.apply();

    CC.audio;                     // (module is passive until unlocked)
    CC.settings.init();
    CC.map.init();
    CC.customizer.init();
    CC.scene.init();
    CC.modes.activate('freeplay');

    // Apply the current location's train preset. CC.trains.applyPreset() no-ops
    // once the child has chosen an engine themselves, so travelling the map can
    // never take away the train they built.
    const loc = CC.world.current;
    if (loc.trainPreset) CC.trains.applyPreset(loc.trainPreset);
    CC.on('location', l => { if (l && l.trainPreset) CC.trains.applyPreset(l.trainPreset); });

    // --- the gate: always available, on every screen ---
    const closeBtn = document.getElementById('closeBtn');
    const openBtn = document.getElementById('openBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => { CC.gate.close(); CC.speech.say(CC.i18n.t('ui.close')); });
    if (openBtn) openBtn.addEventListener('click', () => { CC.gate.open(); CC.speech.say(CC.i18n.t('ui.open')); });
    document.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); CC.gate.toggle(); }
      if (e.code === 'Escape') {
        if (CC.customizer.isOpen) CC.customizer.close();
        else if (CC.settings.isOpen) CC.settings.close();
      }
    });

    // The bell rings the whole time the gate is not open.
    CC.on('gate', e => {
      if (e.state === 'closing') CC.audio.startBell();
      if (e.state === 'opening') CC.audio.stopBell();
    });

    // --- the car counter ---
    CC.on('carpassed', n => refreshCounter(n));
    CC.on('settings', () => refreshCounter());
    refreshCounter();

    // Re-localise everything when the language changes.
    CC.on('languagechange', () => { CC.i18n.apply(); refreshCounter(); });

    // Arm the welcome + audio on the very first gesture.
    ['pointerdown', 'keydown'].forEach(ev =>
      document.addEventListener(ev, firstTouch, { once: false, passive: true }));

    // The rotate prompt shows and hides itself in CSS. All this does is SAY it,
    // because the child cannot read it — and only once the device is actually
    // upright, so a landscape player never hears it. matchMedia rather than a
    // resize handler, so it fires exactly when the CSS flips and cannot drift
    // out of step with what is on screen.
    if (window.matchMedia) {
      const upright = window.matchMedia('(max-aspect-ratio: 115/100)');
      const nag = (on) => { if (on) CC.speech.say(CC.i18n.t('ui.rotate'), { interrupt: true }); };
      if (upright.addEventListener) upright.addEventListener('change', e => nag(e.matches));
      else if (upright.addListener) upright.addListener(e => nag(e.matches));   // older Safari
      // Say it on load too, but only after the first gesture has unlocked speech.
      if (upright.matches) document.addEventListener('pointerdown', () => nag(upright.matches),
                                                     { once: true, passive: true });
      CC.on('languagechange', () => nag(upright.matches));
    }

    // Look for a real crossing gate on the LAN. Silent either way: if there is
    // no device the game is simply unaffected — no spinner, no error.
    CC.gate.autoConnect().catch(() => {});

    // The front door is two stages: a welcome poster with one big green button,
    // then the map. The button is a real gesture, so it is also what unlocks
    // audio and lets the welcome line be spoken. Returning later via 🗺️ goes
    // straight to the map — a child with a train is never walked back here.
    CC.welcome.open();

    console.log('🚂 Chuga Chocho ready — language:', CC.i18n.code, '· location:', loc.id);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})(window.CC = window.CC || {});
