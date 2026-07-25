/* world.js — locations (the geography system). See DESIGN.md §6.
   A location is DATA that scene.js renders, so adding a place = adding an entry
   here (+ art). Place names are spoken in the active language when selected.

   Phase 1.4: implement at least 2 locations end-to-end (Colorado, San Francisco).
   Phase 1.5: the US-map picker chooses among these.
*/
(function (CC) {
  'use strict';

  // Each location: id, state, city (optional), spoken names per language,
  // a scenery descriptor (consumed by scene.js), and a suggested train preset.
  const LOCATIONS = [
    { id:'colorado',   state:'Colorado',   city:null,
      say:{ en:'Colorado', pl:'Kolorado' },
      scenery:{ theme:'mountains', palette:['#bfe6fb','#7fb0d8','#5a7f5a','#3f5e3f'], features:['peaks','pines','stream','snow'] },
      trainPreset:{ engine:'steam' } },

    { id:'sf', state:'California', city:'San Francisco',
      say:{ en:'San Francisco', pl:'San Francisco' },
      scenery:{ theme:'bridge', palette:['#cfe6f5','#e08a5a','#6aa0c8','#355b7a'], features:['goldengate','bay','fog'] },
      trainPreset:{ engine:'electric' } },

    // Stubs to fill during Phase 1 (see DESIGN.md §6 table):
    { id:'chicago',    state:'Illinois',   city:'Chicago',       say:{ en:'Chicago', pl:'Chicago' },           scenery:{ theme:'city',    features:['skyline','L','tunnel','lake'] }, trainPreset:{ engine:'electric' } },
    { id:'bigsur',     state:'California',  city:'Big Sur',       say:{ en:'Big Sur', pl:'Big Sur' },           scenery:{ theme:'coast',   features:['ocean','cliffs','mountains'] },   trainPreset:{ engine:'diesel' } },
    { id:'arizona',    state:'Arizona',    city:null,            say:{ en:'Arizona', pl:'Arizona' },           scenery:{ theme:'desert',  features:['redrock','cacti','mesa'] },       trainPreset:{ engine:'diesel' } },
    { id:'nyc',        state:'New York',   city:'New York City', say:{ en:'New York City', pl:'Nowy Jork' },   scenery:{ theme:'city',    features:['brooklynbridge','subway'] },     trainPreset:{ engine:'electric' } },
    { id:'seattle',    state:'Washington', city:'Seattle',       say:{ en:'Seattle', pl:'Seattle' },           scenery:{ theme:'cascades',features:['evergreens','ferry','mountains'] },trainPreset:{ engine:'electric' } },
    { id:'neworleans', state:'Louisiana',  city:'New Orleans',   say:{ en:'New Orleans', pl:'Nowy Orlean' },   scenery:{ theme:'bayou',   features:['bayou','streetcar','oaks'] },     trainPreset:{ engine:'steam' } },
  ];

  const STORAGE_KEY = 'cc.location';
  let currentId = localStorage.getItem(STORAGE_KEY) || LOCATIONS[0].id;

  const world = {
    all() { return LOCATIONS.slice(); },
    byState() {
      const m = {};
      LOCATIONS.forEach(l => { (m[l.state] = m[l.state] || []).push(l); });
      return m;                       // used by the US-map picker
    },
    get current() { return LOCATIONS.find(l => l.id === currentId) || LOCATIONS[0]; },

    select(id, opts) {
      const loc = LOCATIONS.find(l => l.id === id);
      if (!loc) return;
      currentId = id;
      localStorage.setItem(STORAGE_KEY, id);
      const name = (loc.say && loc.say[CC.i18n.code]) || loc.city || loc.state;
      if (!opts || opts.speak !== false) CC.speech && CC.speech.say(name, { interrupt: true });
      CC.emit && CC.emit('location', loc);
    },
  };

  CC.world = world;
})(window.CC = window.CC || {});
