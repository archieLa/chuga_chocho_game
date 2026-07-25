/* map.js — the US map location picker. See DESIGN.md §6.
   Tap the 🗺️ icon → the US map appears → tap a highlighted (supported) state →
   if it has more than one city, choose one → the world reskins and the place name
   is spoken. Uses the inlined SVG from map-data.js so it works from file://.
*/
(function (CC) {
  'use strict';

  const map = {
    overlay: null,

    init() {
      const btn = document.getElementById('mapBtn');
      if (btn) btn.addEventListener('click', () => this.open());
    },

    open() {
      if (!CC.US_MAP_SVG) { console.warn('map-data.js not loaded'); return; }
      if (!this.overlay) this.build();
      this.showStates();
      this.overlay.hidden = false;
    },
    close() { if (this.overlay) this.overlay.hidden = true; },

    build() {
      const o = document.createElement('div');
      o.className = 'map-overlay';
      o.hidden = true;
      o.innerHTML =
        '<div class="map-head"><span class="map-title">🗺️ Choose a place</span>' +
        '<button class="map-close" aria-label="Close">✕</button></div>' +
        '<div class="map-holder">' + CC.US_MAP_SVG + '</div>' +
        '<div class="map-cities" hidden></div>';
      document.getElementById('wrap').appendChild(o);
      this.overlay = o;

      o.querySelector('.map-close').addEventListener('click', () => this.close());

      // One delegated handler for every supported state.
      const svg = o.querySelector('#us-map');
      const onPick = (e) => {
        const el = e.target.closest && e.target.closest('.state--supported');
        if (el) this.pickState(el.getAttribute('data-name'));
      };
      svg.addEventListener('click', onPick);
      svg.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('state--supported')) {
          e.preventDefault(); this.pickState(e.target.getAttribute('data-name'));
        }
      });
    },

    showStates() {
      if (this.overlay) this.overlay.querySelector('.map-cities').hidden = true;
    },

    pickState(stateName) {
      const locs = CC.world.all().filter(l => l.state === stateName);
      if (!locs.length) return;
      if (locs.length === 1) { this.selectLocation(locs[0]); return; }

      // Multiple cities → show a chooser.
      const box = this.overlay.querySelector('.map-cities');
      box.innerHTML = '<span class="map-title">' + stateName + '</span>';
      locs.forEach(l => {
        const b = document.createElement('button');
        b.className = 'city-btn';
        b.textContent = l.city || l.state;
        b.addEventListener('click', () => this.selectLocation(l));
        box.appendChild(b);
      });
      box.hidden = false;
    },

    selectLocation(loc) {
      CC.world.select(loc.id);        // reskins world + speaks the place name
      this.close();
    },
  };

  CC.map = map;
})(window.CC = window.CC || {});
