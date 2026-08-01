/* trains.js — the train the child owns: one locomotive + exactly THREE wagons,
   each slot individually selectable and individually coloured. See DESIGN.md §5
   and CLAUDE.md §1.6.

   This is the DATA layer only. It knows the catalogue, the current consist, and
   how to persist it. It does not touch the DOM — scene.js renders what this
   module reports, and the customizer UI drives it through the cycling helpers.

   THE MODEL
     consist = { engine: {type, colours}, wagons: [slot, slot, slot] }
   Every slot carries its OWN colours object, which is the whole point: three
   wagons, three different colours. Colour keys map to the recolour hooks baked
   into the SVGs — .cc-loco .cc-wagon .cc-wagon2 .cc-roof .cc-trim .cc-brass.

   PRESETS
   A location suggests an engine (Colorado -> steam, New Orleans -> streetcar).
   That suggestion applies ONLY while the child has not chosen an engine
   themselves. Once they do, `userSet` latches true and presets stop overriding —
   travelling the map must never take away the blue train they picked.
*/
(function (CC) {
  'use strict';

  // Catalogue — keys are manifest.json vehicle ids. Order is the cycling order,
  // so it is deliberate: the most kid-legible engines come first.
  const ENGINES = ['steam', 'diesel', 'electric-hs', 'commuter', 'streetcar', 'cable-car'];
  const WAGONS  = ['wagon-coach-old', 'wagon-coach-modern', 'wagon-boxcar', 'wagon-container',
                   'wagon-hopper', 'wagon-tanker', 'wagon-hs-coach', 'wagon-caboose'];

  const WAGON_SLOTS = 3;                    // fixed: one loco + three wagons

  // A small, high-contrast palette. Big swatches, nameable colours — a three-year-old
  // is choosing these, and the names are already translated in i18n.js under `colors`.
  const PALETTE = [
    { key: 'blue',   hex: '#2a6fd6' },
    { key: 'red',    hex: '#d23b34' },
    { key: 'yellow', hex: '#f2b134' },
    { key: 'green',  hex: '#4f9d4f' },
    { key: 'purple', hex: '#7a3f9e' },
    { key: 'orange', hex: '#e8752a' },
    // A soft charcoal rather than #000: the vehicles carry their shape in
    // shading, and at pure black a wagon flattens into a silhouette — you lose
    // the roof, the panel lines and the windows. This still reads as black.
    { key: 'black',  hex: '#26292f' },
  ];

  const STORAGE_KEY = 'cc.train';

  function defaultConsist() {
    return {
      engine: { type: 'steam', colours: { loco: '#1c1c1e', trim: '#c9a227' } },
      wagons: [
        { type: 'wagon-coach-old',    colours: { wagon: '#2a6fd6', roof: '#3f4750' } },
        { type: 'wagon-boxcar',       colours: { wagon: '#d23b34', roof: '#3f4750' } },
        { type: 'wagon-coach-modern', colours: { wagon: '#4f9d4f', roof: '#3f4750' } },
      ],
      userSet: false,
    };
  }

  function sanitise(c) {
    const d = defaultConsist();
    if (!c || typeof c !== 'object') return d;
    const out = {
      engine: {
        type: ENGINES.indexOf(c.engine && c.engine.type) >= 0 ? c.engine.type : d.engine.type,
        colours: Object.assign({}, d.engine.colours, (c.engine && c.engine.colours) || {}),
      },
      wagons: [],
      userSet: !!c.userSet,
    };
    for (let i = 0; i < WAGON_SLOTS; i++) {
      const w = (c.wagons || [])[i] || {};
      out.wagons.push({
        type: WAGONS.indexOf(w.type) >= 0 ? w.type : d.wagons[i].type,
        colours: Object.assign({}, d.wagons[i].colours, w.colours || {}),
      });
    }
    return out;
  }

  function read() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; } }

  let consist = sanitise(read());

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(consist)); }
  function changed() { save(); CC.emit && CC.emit('train', trains.consist); }
  function step(list, cur, dir) {
    const i = list.indexOf(cur);
    return list[((i < 0 ? 0 : i) + dir + list.length) % list.length];
  }

  const trains = {
    ENGINES, WAGONS, PALETTE, WAGON_SLOTS,

    /** Deep copy, so callers can't mutate our state by accident. */
    get consist() { return JSON.parse(JSON.stringify(consist)); },

    /** Manifest entry for a vehicle id — length/originFromRear/label/file. */
    meta(type) { return (CC.manifest && CC.manifest.vehicles && CC.manifest.vehicles[type]) || null; },

    /** Front-to-back list the renderer consumes: [engine, w0, w1, w2]. */
    vehicles() {
      return [Object.assign({ slot: 'engine' }, consist.engine)]
        .concat(consist.wagons.map((w, i) => Object.assign({ slot: i }, w)));
    },

    // ---- selection: the customizer cycles with these ----------------------
    /** dir = +1 next, -1 previous. Cycling the engine counts as a user choice. */
    cycleEngine(dir) {
      consist.engine.type = step(ENGINES, consist.engine.type, dir < 0 ? -1 : 1);
      consist.userSet = true;
      changed();
      return consist.engine.type;
    },
    setEngine(type) {
      if (ENGINES.indexOf(type) < 0) return;
      consist.engine.type = type; consist.userSet = true; changed();
    },

    /** Cycle the wagon in slot 0..2. Wagon choices do NOT latch userSet — only the
        engine is preset-driven, so wagons are always the child's alone. */
    cycleWagon(slot, dir) {
      const w = consist.wagons[slot]; if (!w) return null;
      w.type = step(WAGONS, w.type, dir < 0 ? -1 : 1);
      changed();
      return w.type;
    },
    setWagon(slot, type) {
      const w = consist.wagons[slot];
      if (!w || WAGONS.indexOf(type) < 0) return;
      w.type = type; changed();
    },

    // ---- colour: PER SLOT, never global -----------------------------------
    /** slot: 'engine' | 0 | 1 | 2. part: loco|wagon|wagon2|roof|trim|brass. */
    setColour(slot, part, hex) {
      const target = slot === 'engine' ? consist.engine : consist.wagons[slot];
      if (!target) return;
      const next = Object.assign({}, target.colours);
      next[part] = hex;
      target.colours = next;
      changed();
    },
    /** Convenience for the UI: recolour a slot's main body. */
    setBodyColour(slot, hex) {
      this.setColour(slot, slot === 'engine' ? 'loco' : 'wagon', hex);
    },
    colourOf(slot, part) {
      const t = slot === 'engine' ? consist.engine : consist.wagons[slot];
      return (t && t.colours && t.colours[part]) || null;
    },

    // ---- location presets --------------------------------------------------
    /** Apply a location's suggested engine, unless the child has chosen one. */
    applyPreset(preset) {
      if (!preset || consist.userSet) return false;
      if (preset.engine && ENGINES.indexOf(preset.engine) >= 0 && preset.engine !== consist.engine.type) {
        consist.engine.type = preset.engine;
        changed();
        return true;
      }
      return false;
    },
    /** "Let the places choose again" — hands control back to the presets. */
    releasePreset() { consist.userSet = false; changed(); },

    reset() { consist = defaultConsist(); changed(); },
  };

  CC.trains = trains;
})(window.CC = window.CC || {});
