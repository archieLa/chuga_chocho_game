/* welcome.js — stage one of the front door.

   The game used to open straight onto the map, which is a picking screen: it
   never said "train game", and the welcome line had to be fired from an
   invisible first-gesture listener because browsers block speech until the child
   touches something.

   This screen fixes both. It is a poster — sky, grass, a rail and a blue steam
   train rolling down it — with exactly ONE thing you can press. That press is a
   real gesture, so it is the honest moment to unlock audio and say hello, and
   then it hands over to the map.

   It shows once per launch. Tapping 🗺️ later goes straight to the map, because
   a child who already has a train must never be walked back through a splash.

   When the second game mode lands (DESIGN.md §11), this is where the choice
   goes: the button row grows from one to two and nothing else needs to move.

   The train is deliberately NOT the child's saved consist — it is a fixed blue
   steam mascot, so the front door looks the same on a fresh install as it does
   on day fifty. Their own train is the reward in the scene and the customizer.
*/
(function (CC) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // The mascot: a blue steam engine and two coaches. Types come from the
  // manifest, so this is assembled from art the game already ships.
  const MASCOT = [
    { type: 'steam',            colours: { loco: '#2a6fd6', trim: '#f2b134', brass: '#f2b134' } },
    { type: 'wagon-coach-old',  colours: { wagon: '#d23b34', roof: '#3f4750' } },
    { type: 'wagon-coach-old',  colours: { wagon: '#f2b134', roof: '#3f4750' } },
  ];

  const SPEED = 90;          // local units per second — an amble, not a dash
  const GAP = 10;
  const TOP = -150, BOT = 22; // the world slice the strip shows

  const welcome = {
    el: null,
    shown: false,
    raf: 0,
    train: null,

    init() {
      // Nothing to do until it is opened; main.js decides that.
    },

    open() {
      if (!this.el) this.build();
      this.el.hidden = false;
      this.shown = true;
      // Shrinks the two gate buttons into the corner, the same way the map and
      // the other overlays do. They stay live — rule #1 — but on this screen the
      // green button has to be the obvious thing to press.
      document.body.classList.add('overlay-open');
      this.start();
    },

    close() {
      if (!this.el) return;
      this.el.hidden = true;
      this.shown = false;
      document.body.classList.remove('overlay-open');
      this.stop();
    },

    build() {
      const o = document.createElement('div');
      o.className = 'wel-overlay cc-sky';
      o.hidden = true;
      o.innerHTML =
        '<div class="cc-cloud cc-cloud--a"></div>' +
        '<div class="cc-cloud cc-cloud--b"></div>' +
        '<div class="cc-cloud cc-cloud--c"></div>' +
        '<div class="cc-ground"></div>' +
        '<div class="cc-rail"><div class="cc-track"></div></div>' +
        '<div class="wel-title">🚂 Chuga Chocho!</div>' +
        '<div class="wel-sub" data-i18n="readyToRide"></div>' +
        '<button class="wel-go" data-i18n="allAboard"></button>';
      document.getElementById('wrap').appendChild(o);
      this.el = o;

      this.mountTrain();
      CC.i18n.apply(o);

      o.querySelector('.wel-go').addEventListener('click', () => this.depart());
      // Re-label live if the language is switched from the settings panel.
      CC.on('languagechange', () => { if (this.el) CC.i18n.apply(this.el); });
    },

    /** Hand over to the map. The global first-gesture listener in main.js has
        already unlocked audio and started the welcome line on this same tap. */
    depart() {
      CC.audio.blip();
      this.close();
      CC.map.open();
    },

    // -------------------------------------------------------------------
    // The rolling mascot. Same renderer the scene and the customizer use.
    // -------------------------------------------------------------------
    mountTrain() {
      if (!CC.rolling || !CC.assets) return;
      const items = CC.rolling.layout(MASCOT, GAP);

      // World bounds of the whole consist. A vehicle's origin sits
      // originFromRear ahead of its rear end, so read both from the manifest
      // rather than assuming any vehicle's size.
      let minX = 0, maxX = 0;
      items.forEach(it => {
        const m = CC.rolling.meta(it.type) || { length: it.length, originFromRear: it.length / 2 };
        minX = Math.min(minX, it.offset - m.originFromRear);
        maxX = Math.max(maxX, it.offset + (m.length - m.originFromRear));
      });

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'cc-roller');
      svg.setAttribute('viewBox', minX + ' ' + TOP + ' ' + (maxX - minX) + ' ' + (BOT - TOP));
      svg.setAttribute('aria-hidden', 'true');

      const g = document.createElementNS(NS, 'g');
      const cars = [];
      items.forEach(it => {
        const v = CC.rolling.build(it.type, it.colours);
        v.setAttribute('transform', 'translate(' + it.offset + ',0)');
        g.appendChild(v);
        cars.push(v);
      });
      svg.appendChild(g);
      this.el.querySelector('.cc-rail').appendChild(svg);

      this.train = { svg: svg, cars: cars, world: maxX - minX, dist: 0, x: 0, started: false };
    },

    start() {
      if (this.raf || !this.train) return;
      let last = 0;
      const step = (t) => {
        if (!this.shown) { this.raf = 0; return; }
        const dt = last ? Math.min(t - last, 50) : 16;
        last = t;
        this.advance(dt);
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    },

    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    },

    advance(dt) {
      const tr = this.train;
      if (!tr) return;
      const rail = this.el.querySelector('.cc-rail');
      const box = tr.svg.getBoundingClientRect();
      if (!box.width) return;                       // not laid out yet
      const scale = box.width / tr.world;           // px per local unit
      const railW = rail.clientWidth;

      // Vehicles are drawn facing +x and the engine sits at the FRONT of the
      // consist, so the train has to travel left-to-right or it runs backwards
      // with the coaches leading.
      if (!tr.started) { tr.x = -box.width; tr.started = true; }
      tr.x += SPEED * scale * (dt / 1000);
      if (tr.x > railW) tr.x = -box.width;                    // round again
      tr.dist += SPEED * (dt / 1000);

      tr.svg.style.transform = 'translateX(' + tr.x.toFixed(1) + 'px)';
      tr.cars.forEach(v => CC.rolling.spin(v, tr.dist));
    },
  };

  CC.welcome = welcome;
})(window.CC = window.CC || {});
