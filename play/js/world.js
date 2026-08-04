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
    { id:'austin', state:'Texas', city:'Austin',
      say:{ en:'Austin', pl:'Austin' },
      scene:'austin',
      scenery:{ theme:'dusk-city', features:['bats','congressbridge','capitol','ladybirdlake','foodtrucks'] },
      trainPreset:{ engine:'commuter' } },

    { id:'houston', state:'Texas', city:'Houston',
      say:{ en:'Houston', pl:'Houston' },
      scene:'houston',
      scenery:{ theme:'space', features:['shuttle','boeing747','saturnv','liveoaks','refinery'] },
      trainPreset:{ engine:'diesel' } },

    { id:'cape', state:'Florida', city:'Cape Canaveral',
      say:{ en:'Cape Canaveral', pl:'Cape Canaveral' },
      scene:'cape-canaveral',
      scenery:{ theme:'space-coast', features:['rocket','vab','lagoon','saltmarsh','gator','palmetto'] },
      trainPreset:{ engine:'diesel' } },

    { id:'oahu', state:'Hawaii', city:'O\u02bbahu',
      say:{ en:'Oahu', pl:'Oahu' },
      scene:'oahu',
      scenery:{ theme:'island', features:['diamondhead','reef','waikiki','outrigger','palms','hula'] },
      trainPreset:{ engine:'cane-tank' } },

    { id:'denali', state:'Alaska', city:'Denali',
      say:{ en:'Denali', pl:'Denali' },
      scene:'denali',
      // The view is the real one: the Alaska Range from the Susitna flats near
      // Talkeetna, where the Alaska Railroad runs. Night, aurora, September.
      scenery:{ theme:'aurora', features:['alaskarange','aurora','spruce','susitna','moose','cabin'] },
      // Alaska Railroad livery is a recolour of the diesel — blue and gold.
      trainPreset:{ engine:'diesel' } },

    { id:'vegas', state:'Nevada', city:'Las Vegas',
      say:{ en:'Las Vegas', pl:'Las Vegas' },
      scene:'las-vegas',
      scenery:{ theme:'night-city', features:['neon','welcomesign','strip','palms','desertmountains'] },
      // The game's only NIGHT scene — if a day/night tint or ambient audio is ever
      // added, this is the one that will show it.
      trainPreset:{ engine:'monorail' } },

    { id:'moab', state:'Utah', city:'Moab',
      say:{ en:'Moab', pl:'Moab' },
      scene:'moab',
      // Viewpoint: Delicate Arch from the slickrock bowl below it, La Sals behind.
      scenery:{ theme:'redrock', features:['delicatearch','slickrock','lasals','juniper','jeep'] },
      trainPreset:{ engine:'diesel' } },

    { id:'nashville', state:'Tennessee', city:'Nashville',
      say:{ en:'Nashville', pl:'Nashville' },
      scene:'nashville',
      // Viewpoint: Lower Broadway looking west, late afternoon — honky tonk neon on
      // Victorian commercial brick, downtown and the AT&T building stacked up behind.
      scenery:{ theme:'city', features:['honkytonks','neon','batmanbuilding','busker'] },
      trainPreset:{ engine:'diesel' } },

    { id:'boston', state:'Massachusetts', city:'Boston',
      say:{ en:'Boston', pl:'Boston' },
      scene:'boston',
      // Viewpoint: Back Bay across the Charles from the Cambridge bank, early autumn.
      // The engine is the Green Line, which is why no trolley is drawn into the scene.
      scenery:{ theme:'river', features:['backbay','hancock','charles','esplanade','bridge'] },
      trainPreset:{ engine:'streetcar', bodyColour:'#2f7d4a' } },

    { id:'yellowstone', state:'Wyoming', city:'Yellowstone',
      say:{ en:'Yellowstone', pl:'Yellowstone' },
      scene:'yellowstone',
      // Viewpoint: the LAMAR VALLEY, not the Upper Geyser Basin — the Absaroka wall above a
      // golden sage flat, the Lower Falls cut into the foothills, and the thermal ground
      // pushed to the right, clear of the crossing. (The handoff's own §6 says this; the
      // comment shipped with the entry described the basin version that was abandoned.)
      // First scene with an animal population — the bison herd and elk are static art.
      scenery:{ theme:'valley', features:['absaroka','bison','elk','lowerfalls','geyser','sinter'] },
      trainPreset:{ engine:'steam' } },

    { id:'dc', state:'District of Columbia', city:'Washington',
      // Shown as "Washington"; spoken as "Washington D C" so the voice reads the
      // letters instead of slurring them. See world.spoken().
      say:{ en:'Washington', pl:'Waszyngton' },
      sayAs:{ en:'Washington D C' },
      scene:'washington-dc',
      // Viewpoint: the Tidal Basin at peak cherry blossom. The Capitol is small and distant
      // on purpose — from here that is where it actually is.
      scenery:{ theme:'monumental', features:['jefferson','monument','capitol','cherryblossom'] },
      trainPreset:{ engine:'commuter' } },

    { id:'miami', state:'Florida', city:'Miami Beach',
      say:{ en:'Miami Beach', pl:'Miami Beach' },
      scene:'miami-beach',
      // Viewpoint: Ocean Drive looking north — the set's first asymmetric composition,
      // Deco row and palms left, beach and Atlantic right.
      scenery:{ theme:'deco-beach', features:['artdeco','lifeguardtowers','palms','atlantic'] },
      trainPreset:{ engine:'commuter' } },

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
        Names that have no Polish form stay English (Rocky Mountains, Seattle,
        Austin), and an English name read by a Polish voice is not recognisable
        — so it is spoken by an English voice. See DESIGN.md §8.

        `say` is what is SHOWN; optional `sayAs` is what the voice is given when
        the two differ. Washington needs "Washington D C" to be read out as
        letters rather than slurred, but nobody should have to look at that on a
        button. Exactly the split i18n.welcome already makes with text/sayAs. */
    spoken(loc, code) {
      const lang = code || CC.i18n.code;
      const shown = (loc.say && loc.say[lang]) || loc.city || loc.state;
      const text = (loc.sayAs && loc.sayAs[lang]) || shown;
      const untranslated = loc.say && loc.say.en === shown && lang !== 'en';
      return { text: text, lang: untranslated ? 'en' : lang };
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
