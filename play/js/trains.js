/* trains.js — train configuration + customization. See DESIGN.md §5.
   Engine type, loco color, wagon color, wagon type. Choices PERSIST and override
   per-location presets. SVG parts are swapped/recolored at runtime.

   Phase 1.6: build the customizer UI + render swaps in scene.js.
*/
(function (CC) {
  'use strict';

  const ENGINES = ['steam', 'diesel', 'electric'];
  const WAGONS  = ['boxcar', 'container', 'passenger', 'gondola', 'tanker'];
  const STORAGE_KEY = 'cc.train';

  const defaults = { engine: 'steam', locoColor: '#1c1c1e', wagonColor: '#2a6fd6', wagon: 'passenger', userSet: false };
  let cfg = load();

  function load() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
    catch (e) { return Object.assign({}, defaults); }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }

  const trains = {
    ENGINES, WAGONS,
    get config() { return Object.assign({}, cfg); },

    /** User customization — marks userSet so location presets stop overriding. */
    set(patch) {
      cfg = Object.assign({}, cfg, patch, { userSet: true });
      save();
      CC.emit && CC.emit('train', this.config);
    },

    /** Apply a location's suggested preset ONLY if the user hasn't customized. */
    applyPreset(preset) {
      if (cfg.userSet || !preset) return;
      cfg = Object.assign({}, cfg, preset);
      save();
      CC.emit && CC.emit('train', this.config);
    },

    reset() { cfg = Object.assign({}, defaults); save(); CC.emit && CC.emit('train', this.config); },
  };

  CC.trains = trains;
})(window.CC = window.CC || {});
