/* map.js — the US map, which is also the front door.

   The game OPENS here. A child sees the United States, taps a coloured state,
   hears its full name, picks a place, and rides there. The 🗺️ button in the
   scene brings it back. There is always a way out: if you have already been
   somewhere, a big ✕ takes you straight back to it.

   The map itself is the offline SVG inlined in map-data.js, so this works when
   the game is opened straight from disk.
*/
(function (CC) {
  'use strict';

  const map = {
    overlay: null,
    open_: false,
    visited: false,          // have we ever left the map this session?

    get isOpen() { return this.open_; },

    init() {
      const btn = document.getElementById('mapBtn');
      if (btn) btn.addEventListener('click', () => { CC.audio.blip(); this.open(); });
      CC.on('languagechange', () => this.relabel());
    },

    open() {
      if (!CC.US_MAP_SVG) { console.error('map-data.js not loaded'); return; }
      if (!this.overlay) this.build();
      this.clearChoice();
      this.overlay.hidden = false;
      this.open_ = true;
      document.body.classList.add('map-open');
      this.relabel();
    },

    close() {
      if (!this.overlay) return;
      this.overlay.hidden = true;
      this.open_ = false;
      this.visited = true;
      document.body.classList.remove('map-open');
    },

    build() {
      const o = document.createElement('div');
      // Same world chrome as the welcome screen: this is stage two of the front
      // door, not a separate panel. No moving train here on purpose — the map is
      // the thing to look at, so nothing competes with it.
      o.className = 'map-overlay cc-sky';
      o.hidden = true;
      o.innerHTML =
        '<div class="cc-ground"></div>' +
        // The rail continues from the welcome screen, but with no train on it:
        // the map is the thing to look at, so nothing here moves.
        '<div class="cc-rail"><div class="cc-track"></div></div>' +
        '<div class="map-head">' +
          '<span class="map-title" data-i18n="pickPlace">Where shall we go?</span>' +
          '<button class="map-close" data-i18n-title="back" title="Back">✕</button>' +
        '</div>' +
        '<div class="map-holder">' + CC.US_MAP_SVG + '</div>' +
        // No written instruction here: the playable states pulse instead, which
        // is an affordance a pre-reader can actually use. This row stays empty
        // until a state is tapped, then fills with its name and destinations.
        '<div class="map-cities"></div>';
      document.getElementById('wrap').appendChild(o);
      this.overlay = o;

      o.querySelector('.map-close').addEventListener('click', () => {
        CC.audio.blip();
        this.close();
      });

      // One delegated handler covers the whole map. A tap on a state we can
      // travel to opens its places; a tap on any OTHER state still says its
      // name out loud, because a three-year-old will tap Texas and getting
      // nothing back is the one thing this game never does.
      const svg = o.querySelector('#us-map');
      const hit = (e) => {
        const el = e.target.closest && e.target.closest('.state');
        if (!el) return;
        const name = el.getAttribute('data-name');
        if (el.classList.contains('state--supported')) this.pickState(name);
        else this.nameState(el, name);
      };
      svg.addEventListener('click', hit);
      svg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(e); }
      });
    },

    /** A state we have no scene for yet: say its name and give it a moment of
        colour, so the tap is still worth something. */
    nameState(el, name) {
      if (!name) return;
      CC.audio.blip();
      CC.speech && CC.speech.say(name, { interrupt: true, lang: 'en' });
      el.classList.add('state--said');
      setTimeout(() => el.classList.remove('state--said'), 1100);
    },

    relabel() {
      if (!this.overlay) return;
      CC.i18n.apply(this.overlay);
      // The ✕ only makes sense once there is a scene to go back to.
      this.overlay.querySelector('.map-close').hidden = !this.visited;
    },

    clearChoice() {
      if (!this.overlay) return;
      this.overlay.querySelectorAll('.state--picked').forEach(e => e.classList.remove('state--picked'));
      const box = this.overlay.querySelector('.map-cities');
      box.innerHTML = '';                 // back to "nothing chosen": the pulse is the cue
    },

    /* The map only shows two-letter abbreviations. Tapping a state reveals its
       FULL NAME (spoken aloud too — that's the geography lesson) along with the
       places you can travel to. Statewide locations get a single button, so the
       interaction is the same everywhere. */
    pickState(stateName) {
      const locs = CC.world.all().filter(l => l.state === stateName);
      if (!locs.length) return;
      CC.audio.blip();

      this.overlay.querySelectorAll('.state--picked').forEach(e => e.classList.remove('state--picked'));
      const shape = this.overlay.querySelector('[data-name="' + stateName + '"]');
      if (shape) shape.classList.add('state--picked');

      // State names are American proper nouns — always spoken in English.
      CC.speech && CC.speech.say(stateName, { interrupt: true, lang: 'en' });

      const box = this.overlay.querySelector('.map-cities');
      box.innerHTML = '';
      const label = document.createElement('span');
      label.className = 'state-name';
      label.textContent = stateName;
      box.appendChild(label);
      locs.forEach(l => {
        const b = document.createElement('button');
        b.className = 'city-btn';
        b.textContent = (l.say && l.say[CC.i18n.code]) || l.city || l.state;
        b.addEventListener('click', () => this.selectLocation(l));
        box.appendChild(b);
      });
    },

    selectLocation(loc) {
      CC.world.select(loc.id);        // reskins the world AND speaks the place name
      this.close();
    },
  };

  CC.map = map;
})(window.CC = window.CC || {});
