/* world.js — locations (the geography system). See DESIGN.md §6.
   A location is a DESTINATION: a city (San Francisco) or a natural place
   (Rocky Mountains). It is never just the state name repeated. How many
   destinations a state has follows how many visually distinct looks it has —
   California has two, Colorado has one (for now). The interaction is what stays
   uniform: tap a state -> full name -> pick a destination.
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
    { id:'colorado',   state:'Colorado',   city:'Rocky Mountains',
      say:{ en:'Rocky Mountains', pl:'Rocky Mountains' },
      scene:'colorado',
      scenery:{ theme:'mountains', features:['peaks','aspens','trestle','creek','redrock'] },
      trainPreset:{ engine:'steam' } },

    { id:'sf', state:'California', city:'San Francisco',
      say:{ en:'San Francisco', pl:'San Francisco' },
      scene:'sf',
      scenery:{ theme:'bridge', features:['goldengate','paintedladies','lombard','bay','fog'] },
      trainPreset:{ engine:'cable-car' } },

    { id:'la', state:'California', city:'Los Angeles',
      say:{ en:'Los Angeles', pl:'Los Angeles' },
      scene:'la',
      scenery:{ theme:'beach', features:['ocean','sand','musclebeach','volleyball','palms','hollywood'] },
      trainPreset:{ engine:'commuter' } },

    { id:'chicago',    state:'Illinois',   city:'Chicago',       say:{ en:'Chicago', pl:'Chicago' },           scene:'chicago', scenery:{ theme:'city',    features:['skyline','L','tunnel','lake'] },   trainPreset:{ engine:'commuter' } },
    { id:'arizona',    state:'Arizona',    city:'Grand Canyon',  say:{ en:'Grand Canyon', pl:'Wielki Kanion' }, scene:'grand-canyon', scenery:{ theme:'canyon',  features:['canyonwalls','mesas','rimpines','saguaro'] }, trainPreset:{ engine:'diesel' } },
    { id:'nyc',        state:'New York',   city:'New York City', say:{ en:'New York City', pl:'Nowy Jork' },   scene:'nyc', scenery:{ theme:'city',    features:['brooklynbridge','subway'] },      trainPreset:{ engine:'commuter' } },
    { id:'seattle',    state:'Washington', city:'Seattle',       say:{ en:'Seattle', pl:'Seattle' },           scene:'seattle', scenery:{ theme:'cascades',features:['evergreens','ferry','mountains'] },trainPreset:{ engine:'commuter' } },
    { id:'neworleans', state:'Louisiana',  city:'New Orleans',   say:{ en:'New Orleans', pl:'Nowy Orlean' },   scene:'new-orleans', scenery:{ theme:'bayou',   features:['cathedral','galleries','riverboat','oaks'] }, trainPreset:{ engine:'streetcar' } },
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

    /** The place name in the active language, plus which voice should say it.
        Names that have no Polish form stay English (Rocky Mountains, Seattle),
        and an English name read by a Polish voice is not recognisable — so it
        is spoken by an English voice. See DESIGN.md §8. */
    spoken(loc, code) {
      const lang = code || CC.i18n.code;
      const name = (loc.say && loc.say[lang]) || loc.city || loc.state;
      const untranslated = loc.say && loc.say.en === name && lang !== 'en';
      return { text: name, lang: untranslated ? 'en' : lang };
    },

    select(id, opts) {
      const loc = LOCATIONS.find(l => l.id === id);
      if (!loc) return;
      currentId = id;
      localStorage.setItem(STORAGE_KEY, id);
      const s = this.spoken(loc);
      if (!opts || opts.speak !== false) {
        CC.speech && CC.speech.say(s.text, { interrupt: true, lang: s.lang });
      }
      CC.emit && CC.emit('location', loc);
    },
  };

  CC.world = world;
})(window.CC = window.CC || {});
