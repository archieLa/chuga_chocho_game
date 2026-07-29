/* customizer.js — "my train": pick an engine, pick three wagons, colour each one.

   This is the screen the child will spend the most time on, so it is built the
   way a picture book works rather than the way a settings dialog works:

     · ONE vehicle at a time, big and in the middle, with a huge ◀ and ▶ either
       side. Pressing an arrow swaps it in place, so you can look through the
       whole catalogue without ever making a wrong choice.
     · Four slots along the bottom — the engine and wagons one, two, three —
       drawn as the actual little train, so you tap the picture of the thing you
       want to change.
     · Six big round colours. A colour applies to THE SELECTED SLOT ONLY. Three
       wagons, three different colours; that is the whole point, and it is why
       every recolour here is scoped to one vehicle's own group (CC.rolling.paint)
       and never to the document.
     · Everything is spoken. A pre-reader plays this by ear.

   CC.trains owns the data and the persistence; this file owns the pictures.
   The preview is alive — wheels turn and the steam engine's side rods run —
   because a still picture of a train is not a train.
*/
(function (CC) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  const customizer = {
    root: null,
    slot: 'engine',        // 'engine' | 0 | 1 | 2
    open_: false,
    dist: 0,
    raf: 0,

    get isOpen() { return this.open_; },

    init() {
      const btn = document.getElementById('trainBtn');
      if (btn) btn.addEventListener('click', () => { CC.audio.blip(); this.open(); });
      CC.on('languagechange', () => { if (this.root) this.render(); });
    },

    open() {
      if (!this.root) this.build();
      this.root.hidden = false;
      this.open_ = true;
      document.body.classList.add('overlay-open');
      this.render();
      this.tick();
    },

    close() {
      if (!this.root) return;
      this.root.hidden = true;
      this.open_ = false;
      document.body.classList.remove('overlay-open');
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    },

    build() {
      const o = document.createElement('div');
      o.className = 'train-overlay';
      o.hidden = true;
      o.innerHTML =
        '<div class="tc-head">' +
          '<span class="tc-title" data-i18n="chooseTrain"></span>' +
          '<button class="tc-done" data-i18n="done"></button>' +
        '</div>' +
        '<div class="tc-stage">' +
          '<button class="tc-arrow tc-prev" aria-label="◀">◀</button>' +
          '<div class="tc-preview"></div>' +
          '<button class="tc-arrow tc-next" aria-label="▶">▶</button>' +
        '</div>' +
        '<div class="tc-name"></div>' +
        '<div class="tc-slots"></div>' +
        '<div class="tc-colours"></div>';
      document.getElementById('wrap').appendChild(o);
      this.root = o;

      o.querySelector('.tc-done').addEventListener('click', () => { CC.audio.blip(); this.close(); });
      o.querySelector('.tc-prev').addEventListener('click', () => this.cycle(-1));
      o.querySelector('.tc-next').addEventListener('click', () => this.cycle(1));
    },

    /** Which vehicle type is in the selected slot right now. */
    currentType() {
      const c = CC.trains.consist;
      return this.slot === 'engine' ? c.engine.type : c.wagons[this.slot].type;
    },
    currentColours() {
      const c = CC.trains.consist;
      return this.slot === 'engine' ? c.engine.colours : c.wagons[this.slot].colours;
    },

    cycle(dir) {
      CC.audio.blip();
      if (this.slot === 'engine') CC.trains.cycleEngine(dir);
      else CC.trains.cycleWagon(this.slot, dir);
      this.render();
      CC.speech.say(CC.i18n.vehicle(this.currentType()), { interrupt: true });
    },

    selectSlot(slot) {
      CC.audio.blip();
      this.slot = slot;
      this.render();
      CC.speech.say(this.slotName(slot), { interrupt: true });
    },

    slotName(slot) {
      return slot === 'engine'
        ? CC.i18n.t('ui.engine')
        : CC.i18n.t('ui.wagon') + ' ' + CC.i18n.number(slot + 1);
    },

    chooseColour(entry) {
      CC.audio.blip();
      CC.trains.setBodyColour(this.slot, entry.hex);
      this.render();
      CC.speech.say(CC.i18n.t('colors.' + entry.key), { interrupt: true });
    },

    /** A framed, self-contained picture of one vehicle. The frame comes from the
        manifest (length / originFromRear), so nothing here hard-codes a size. */
    vehicleSvg(type, colours, cls) {
      const m = CC.rolling.meta(type) || { length: 300, originFromRear: 150 };
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', (-m.originFromRear - 25) + ' -170 ' + (m.length + 50) + ' 190');
      svg.setAttribute('class', cls);
      svg.setAttribute('aria-hidden', 'true');
      // A scrap of rail so the vehicle is standing on something.
      const rail = document.createElementNS(NS, 'rect');
      rail.setAttribute('x', -m.originFromRear - 25);
      rail.setAttribute('y', 0);
      rail.setAttribute('width', m.length + 50);
      rail.setAttribute('height', 7);
      rail.setAttribute('fill', '#a98c68');
      svg.appendChild(rail);
      const g = CC.rolling.build(type, colours);
      svg.appendChild(g);
      return { svg: svg, group: g };
    },

    render() {
      if (!this.root) return;
      CC.i18n.apply(this.root);
      const consist = CC.trains.consist;
      const type = this.currentType();

      // --- the big animated preview ---
      const stage = this.root.querySelector('.tc-preview');
      stage.textContent = '';
      const built = this.vehicleSvg(type, this.currentColours(), 'tc-vehicle');
      stage.appendChild(built.svg);
      this.previewGroup = built.group;
      this.previewType = type;

      this.root.querySelector('.tc-name').textContent = CC.i18n.vehicle(type);

      // --- the four slots, drawn as the train itself ---
      const slots = this.root.querySelector('.tc-slots');
      slots.textContent = '';
      const entries = [{ slot: 'engine', v: consist.engine }]
        .concat(consist.wagons.map((w, i) => ({ slot: i, v: w })));
      entries.forEach(entry => {
        const b = document.createElement('button');
        b.className = 'tc-slot' + (entry.slot === this.slot ? ' is-on' : '');
        b.setAttribute('aria-label', this.slotName(entry.slot));
        b.appendChild(this.vehicleSvg(entry.v.type, entry.v.colours, 'tc-thumb').svg);
        const tag = document.createElement('span');
        tag.className = 'tc-slot-tag';
        tag.textContent = entry.slot === 'engine' ? '🚂' : String(entry.slot + 1);
        b.appendChild(tag);
        b.addEventListener('click', () => this.selectSlot(entry.slot));
        slots.appendChild(b);
      });

      // --- six big colours, applied to the selected slot alone ---
      const box = this.root.querySelector('.tc-colours');
      box.textContent = '';
      const bodyPart = this.slot === 'engine' ? 'loco' : 'wagon';
      const chosen = (this.currentColours() || {})[bodyPart];
      CC.trains.PALETTE.forEach(entry => {
        const b = document.createElement('button');
        b.className = 'tc-swatch' + (entry.hex === chosen ? ' is-on' : '');
        b.style.background = entry.hex;
        b.setAttribute('aria-label', CC.i18n.t('colors.' + entry.key));
        b.addEventListener('click', () => this.chooseColour(entry));
        box.appendChild(b);
      });
    },

    /** Keep the previewed vehicle rolling gently on the spot. */
    tick() {
      if (!this.open_) return;
      this.dist += 1.6;
      if (this.previewGroup) CC.rolling.roll(this.previewGroup, this.dist, this.previewType);
      this.raf = requestAnimationFrame(() => this.tick());
    },
  };

  CC.customizer = customizer;
})(window.CC = window.CC || {});
