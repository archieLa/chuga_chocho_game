/* modes.js — game modes. Phase 1 ships only Free Play. See DESIGN.md §11.

   Phase 2 adds the "missions" framework (difficulty levels, no-fail feedback):
     - Count & Close  (close after N cars of a color; combos for harder levels)
     - Letter Hunt    (spell a word by closing the gate on each next letter)
     - Picture Word   (close the gate when the word naming a picture appears)

   In every mode the gate buttons / physical button are the child's input, and the
   gate is never disabled. Keep this a small registry so modes stay independent.
*/
(function (CC) {
  'use strict';

  const registry = {};
  let active = 'freeplay';

  function register(id, mode) { registry[id] = mode; }

  // Free Play: no goals — press the buttons, the train crosses. That's the whole point.
  register('freeplay', {
    id: 'freeplay',
    start() { /* nothing to set up */ },
    stop() {},
  });

  const modes = {
    register,
    list() { return Object.keys(registry); },
    get active() { return active; },
    activate(id) {
      if (!registry[id]) return;
      if (registry[active] && registry[active].stop) registry[active].stop();
      active = id;
      if (registry[active].start) registry[active].start();
      CC.emit && CC.emit('mode', id);
    },
  };

  CC.modes = modes;
})(window.CC = window.CC || {});
