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
    drawSeq: 0,              // bumped by close(), so a reveal in flight gives up

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
      this.refreshDice();
    },

    close() {
      if (!this.overlay) return;
      this.drawSeq++;                   // abandons a reveal that is still running
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
          // Drawn WITHOUT replacement — see world.drawRandom. The count is not
          // decoration: it is the reason the button is worth pressing again.
          '<button class="map-dice" data-i18n-title="surprise">' +
            '<span class="dice-face">🎲</span>' +
            '<span class="dice-label" data-i18n="surprise">Surprise me!</span>' +
            '<span class="dice-count"></span>' +
          '</button>' +
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
      o.querySelector('.map-dice').addEventListener('click', () => this.surprise());

      // One delegated handler covers the whole map. A tap on a state we can
      // travel to opens its places; a tap on any OTHER state still says its
      // name out loud, because a three-year-old will tap Texas and getting
      // nothing back is the one thing this game never does.
      const svg = o.querySelector('#us-map');
      const hit = (e) => {
        const el = e.target.closest && e.target.closest('.state');
        if (!el) return;
        // The crowded north-east is one card rather than nine specks — see the
        // note in gen-map.js. It opens a chooser instead of picking a state.
        const zone = el.getAttribute('data-zone');
        if (zone && el.classList.contains('ne-zone')) { this.pickZone(zone); return; }
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

    /** The bag's progress, shown on the button. */
    refreshDice() {
      if (!this.overlay) return;
      const el = this.overlay.querySelector('.dice-count');
      const btn = this.overlay.querySelector('.map-dice');
      if (!el || !btn) return;
      const p = CC.world.explored();
      el.textContent = p.drawn + '/' + p.total;
      btn.disabled = false;
    },

    /* Roll for somewhere to go. Two things make this more than Math.random():
       the bag never repeats until it is empty (world.drawRandom), and the place
       is SHOWN ON THE MAP before we travel — a surprise that teleports teaches a
       child nothing about where anywhere is. */
    surprise() {
      const dice = this.overlay.querySelector('.map-dice');
      if (dice.disabled) return;        // a three-year-old will press it five times
      const res = CC.world.drawRandom();
      if (!res) return;
      const seq = ++this.drawSeq;
      dice.disabled = true;
      CC.audio.blip();
      this.clearChoice();

      const shape = this.overlay.querySelector('[data-name="' + res.loc.state + '"]');
      if (shape) shape.classList.add('state--picked', 'state--surprise');

      const box = this.overlay.querySelector('.map-cities');
      const card = document.createElement('div');
      card.className = 'surprise-card';
      const line = (cls, text) => {
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = text;
        card.appendChild(s);
      };
      // The place, then the STATE it is in — "Bailey Yard, Nebraska", the way an
      // American says where somewhere is. The dice already flash that state on
      // the map, and naming it turns the flash into something a child can hold
      // on to. Choosing a place by hand does NOT do this, deliberately — you
      // just tapped the state, so you know.
      const st = CC.world.spokenState(res.loc);
      if (res.wrapped) line('surprise-allseen', CC.i18n.t('ui.allSeen'));
      line('surprise-kicker', CC.i18n.t('ui.nextStop'));
      line('surprise-name', (res.loc.say && res.loc.say[CC.i18n.code]) || res.loc.city || res.loc.state);
      if (st) line('surprise-state', st.text);
      box.appendChild(card);

      // Every word on that card is spoken, in the order it is written. The
      // kicker is UI language; the place name takes whichever voice its own name
      // wants, which is not always the same one; the state is always English.
      // See world.spoken() and world.spokenState().
      if (CC.speech) {
        const said = CC.world.spoken(res.loc);
        let first = true;
        const say = (txt, lang) => {
          CC.speech.say(txt, { interrupt: first, lang: lang || undefined });
          first = false;
        };
        if (res.wrapped) say(CC.i18n.t('ui.allSeen'));
        say(CC.i18n.t('ui.nextStop'));
        say(said.text, said.lang);
        if (st) say(st.text, st.lang);
      }
      this.refreshDice();
      dice.disabled = true;             // refreshDice re-enables; hold it shut for the reveal

      // Long enough to hear the name and find the state, not so long that a
      // child thinks the button did nothing. There is one more thing to say than
      // there used to be, so the hold grew with it — the card should still be up
      // when the place is named.
      setTimeout(() => {
        if (seq !== this.drawSeq) return;       // they pressed ✕ — leave them where they are
        if (shape) shape.classList.remove('state--surprise');
        CC.world.select(res.loc.id, { speak: false });   // already announced above
        this.close();
      }, res.wrapped ? 4200 : 3000);
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

    /* The crowded north-east. Those states are unhittable at national scale —
       Washington DC is 3x4px, and its label chip comes out 26x15px on a phone
       because the targets live in map units and shrink with the map. So the whole
       column is one card, and pressing it lists the playable ones as full-size
       buttons in the row the cities already use. From there it is the ordinary
       flow: pick a state, then pick a place. */
    pickZone(zone) {
      const svg = this.overlay.querySelector('#us-map');
      const inZone = [].slice.call(svg.querySelectorAll('[data-zone="' + zone + '"].state--supported'))
        .filter(el => !el.classList.contains('state-hit') && !el.classList.contains('ne-zone'))
        .map(el => el.getAttribute('data-name'));
      const names = inZone.filter((n, i) => inZone.indexOf(n) === i);
      if (!names.length) return;
      // One playable state in there? Skip the chooser — an extra tap that only
      // ever has one answer is just a door to open.
      if (names.length === 1) { this.pickState(names[0]); return; }

      CC.audio.blip();
      this.clearChoice();
      const box = this.overlay.querySelector('.map-cities');
      names.forEach(n => {
        const b = document.createElement('button');
        b.className = 'city-btn';
        b.textContent = n;
        b.addEventListener('click', () => this.pickState(n));
        box.appendChild(b);
      });
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
