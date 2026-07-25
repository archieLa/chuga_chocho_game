/* settings.js — the ⚙️ panel: language toggle, car-counter show/hide, and the
   physical-gate device address. Persists via localStorage. See DESIGN.md §7–§9.

   Phase 1: flesh out the panel UI (this stub stores the values + toggles the panel).
*/
(function (CC) {
  'use strict';

  const STORAGE_KEY = 'cc.settings';
  const defaults = { showCounter: true };
  let cfg;
  try { cfg = Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch (e) { cfg = Object.assign({}, defaults); }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }

  const settings = {
    get config() { return Object.assign({}, cfg); },
    set(patch) { cfg = Object.assign({}, cfg, patch); save(); CC.emit && CC.emit('settings', this.config); },

    panelEl: null,
    init() {
      this.panelEl = document.getElementById('panel');
      const gear = document.getElementById('gearBtn');
      if (gear) gear.addEventListener('click', () => this.open());
    },

    open() {
      // TODO (Phase 1): render language buttons (CC.i18n.languages()),
      // a counter show/hide toggle, and the device address field (CC.gate.setAddress).
      if (!this.panelEl) return;
      this.panelEl.hidden = false;
      this.panelEl.innerHTML =
        '<h2>' + CC.i18n.t('ui.settings') + '</h2>' +
        '<p style="opacity:.8;max-width:30ch">Language, car counter, and physical-gate setup go here (Phase 1).</p>' +
        '<button id="panelDone" class="big" style="width:auto;height:auto;border-radius:999px;padding:1rem 2rem;background:#5dd959">' +
        CC.i18n.t('ui.done') + '</button>';
      const done = document.getElementById('panelDone');
      if (done) done.addEventListener('click', () => this.close());
    },
    close() { if (this.panelEl) this.panelEl.hidden = true; },
  };

  CC.settings = settings;
})(window.CC = window.CC || {});
