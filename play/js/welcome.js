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
  // The world slice the strip shows. TOP is well above the stack so smoke has
  // somewhere to rise into, and SMOKE_ROOM extends the viewBox behind the train
  // so puffs are not clipped the moment they leave the chimney.
  const TOP = -250, BOT = 22;
  const SMOKE_ROOM = 320;

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
      // Hides the two gate buttons for this screen only. CC.gate keeps running:
      // the spacebar and a real crossing gate on the LAN still work and stay in
      // sync — there is simply no crossing on screen for the buttons to act on.
      document.body.classList.add('welcome-open');
      this.start();
    },

    close() {
      if (!this.el) return;
      this.el.hidden = true;
      this.shown = false;
      document.body.classList.remove('welcome-open');
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

      const left = minX - SMOKE_ROOM;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'cc-roller');
      svg.setAttribute('viewBox', left + ' ' + TOP + ' ' + (maxX - left) + ' ' + (BOT - TOP));
      svg.setAttribute('aria-hidden', 'true');

      // Smoke goes in first so the train draws over it.
      const smokeG = document.createElementNS(NS, 'g');
      svg.appendChild(smokeG);

      const g = document.createElementNS(NS, 'g');
      const cars = [];
      items.forEach(it => {
        const v = CC.rolling.build(it.type, it.colours);
        v.setAttribute('transform', 'translate(' + it.offset + ',0)');
        if (CC.rolling.isSteam(it.type)) this.addDriver(v);
        g.appendChild(v);
        cars.push({ el: v, type: it.type });
      });
      svg.appendChild(g);
      this.el.querySelector('.cc-rail').appendChild(svg);

      this.train = { svg: svg, cars: cars, smokeG: smokeG, left: left,
                     world: maxX - left, dist: 0, x: 0, started: false,
                     lastChuff: 0, puffs: [], arm: null, wave: 0 };
    },

    /** A child leaning out of the cab window, waving. The window is the
        28x26 pane at x=-66..-38, y=-112..-86 in steam.svg, so he sits on its
        sill. Plain fills, no .cc-* hooks, so recolouring the loco never
        repaints him. */
    addDriver(loco) {
      const mk = (tag, attrs) => {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        return e;
      };
      const boy = mk('g', {});
      boy.appendChild(mk('rect', { x: -61, y: -99, width: 17, height: 14, rx: 5, fill: '#f2b134' })); // body
      boy.appendChild(mk('circle', { cx: -52.5, cy: -108, r: 8.5, fill: '#f6c9a0' }));                // head
      boy.appendChild(mk('path', { d: 'M-61,-111 a8.5,8.5 0 0 1 17,0 z', fill: '#6b4a2a' }));         // hair
      boy.appendChild(mk('circle', { cx: -49, cy: -108, r: 1.4, fill: '#2f2118' }));                  // eye
      // The waving arm — rotated about the shoulder every frame.
      const arm = mk('g', {});
      arm.appendChild(mk('rect', { x: -46, y: -104, width: 13, height: 5, rx: 2.5, fill: '#f6c9a0' }));
      arm.appendChild(mk('circle', { cx: -32, cy: -101.5, r: 3.8, fill: '#f6c9a0' }));
      boy.appendChild(arm);
      loco.appendChild(boy);
      loco._ccArm = arm;
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
      if (tr.x > railW) { tr.x = -box.width; this.clearSmoke(); }   // round again
      const step = SPEED * (dt / 1000);
      tr.dist += step;

      tr.svg.style.transform = 'translateX(' + tr.x.toFixed(1) + 'px)';
      // roll(), not spin(): spin only turns .cc-wheel, and the steam engine's
      // drivers and side rods are real geometry driven by driveSteam(). Using
      // spin() left the locomotive's wheels and rods dead while the coaches ran.
      tr.cars.forEach(c => CC.rolling.roll(c.el, tr.dist, c.type));

      // Same quarter-revolution trigger the scene uses, so the puffs stay locked
      // to the wheels instead of drifting out of step with them.
      const head = tr.cars[0];
      if (head && CC.rolling.isSteam(head.type)) {
        const idx = CC.rolling.chuffIndex(tr.dist);
        if (idx !== tr.lastChuff) { tr.lastChuff = idx; this.puff(); }
      }
      this.updateSmoke(dt, step);

      // The wave. Slower than the wheels so it reads as a person, not a machine.
      tr.wave += dt / 1000;
      if (head && head.el._ccArm) {
        // Held UP and swinging, not level — a level arm reads as pointing at
        // something rather than waving at you.
        const a = -38 + Math.sin(tr.wave * 6) * 20;
        head.el._ccArm.setAttribute('transform', 'rotate(' + a.toFixed(1) + ' -46 -101.5)');
      }
    },

    puff() {
      const tr = this.train, S = CC.rolling.STACK;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('fill', '#ffffff');
      tr.smokeG.appendChild(c);
      tr.puffs.push({ x: S.x, y: S.y, r: 9, o: 0.95, el: c });
      if (tr.puffs.length > 26) this.dropPuff();
    },

    dropPuff() {
      const p = this.train.puffs.shift();
      if (p && p.el.parentNode) p.el.parentNode.removeChild(p.el);
    },

    updateSmoke(dt, step) {
      const tr = this.train, secs = dt / 1000;
      for (let i = tr.puffs.length - 1; i >= 0; i--) {
        const p = tr.puffs[i];
        // Drifting back by exactly the distance the train moved leaves the puff
        // standing still over the ground — the whole SVG is what is moving.
        p.x -= step;
        p.y -= 34 * secs;
        p.r += 11 * secs;
        p.o -= 0.22 * secs;
        if (p.o <= 0 || p.x < tr.left) {
          if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
          tr.puffs.splice(i, 1);
          continue;
        }
        p.el.setAttribute('cx', p.x.toFixed(1));
        p.el.setAttribute('cy', p.y.toFixed(1));
        p.el.setAttribute('r', p.r.toFixed(1));
        p.el.setAttribute('opacity', p.o.toFixed(2));
      }
    },

    clearSmoke() {
      while (this.train.puffs.length) this.dropPuff();
    },
  };

  CC.welcome = welcome;
})(window.CC = window.CC || {});
