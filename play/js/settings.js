/* settings.js — the ⚙️ panel. Everything a grown-up might want to change, two
   taps from the game and closed with one big Done:

     · Language — English / Polski, live, persisted.
     · Car counter — on or off.
     · Sound — on or off.
     · The real crossing gate — address, a Test button, and the honest note
       about HTTPS (see below).
     · Build my train again — hands the child back the default train.

   THE HTTPS NOTE. GitHub Pages serves this game over HTTPS, and no browser will
   let an HTTPS page talk to http://crossinggate.local. That is not a bug we can
   fix from the page, so instead of showing a parent a failure to debug at
   bedtime, the panel says it in one sentence: open the copy you downloaded.
*/
(function (CC) {
  'use strict';

  const STORAGE_KEY = 'cc.settings';
  const defaults = { showCounter: true };
  let cfg;
  try { cfg = Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch (e) { cfg = Object.assign({}, defaults); }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }

  const settings = {
    panelEl: null,
    open_: false,

    get config() { return Object.assign({}, cfg); },
    get isOpen() { return this.open_; },

    set(patch) {
      cfg = Object.assign({}, cfg, patch);
      save();
      CC.emit && CC.emit('settings', this.config);
    },

    init() {
      this.panelEl = document.getElementById('panel');
      const gear = document.getElementById('gearBtn');
      if (gear) gear.addEventListener('click', () => { CC.audio.blip(); this.open(); });
      CC.on('device', () => { if (this.open_) this.deviceStatus(); });
    },

    open() {
      if (!this.panelEl) return;
      this.panelEl.hidden = false;
      this.open_ = true;
      document.body.classList.add('overlay-open');
      this.render();
    },

    close() {
      if (!this.panelEl) return;
      this.panelEl.hidden = true;
      this.open_ = false;
      document.body.classList.remove('overlay-open');
    },

    render() {
      const p = this.panelEl;
      p.textContent = '';

      const h = document.createElement('h2');
      h.textContent = CC.i18n.t('ui.settings');
      p.appendChild(h);

      const list = document.createElement('div');
      list.className = 'set-list';
      p.appendChild(list);

      // --- language ---
      list.appendChild(this.row(CC.i18n.t('ui.language'), (box) => {
        CC.i18n.languages().forEach(l => {
          const b = document.createElement('button');
          b.className = 'set-choice' + (l.code === CC.i18n.code ? ' is-on' : '');
          b.textContent = l.flag + ' ' + l.name;
          b.addEventListener('click', () => {
            CC.audio.blip();
            CC.i18n.set(l.code);
            this.render();
            CC.speech.say(CC.i18n.dict.name, { interrupt: true });
          });
          box.appendChild(b);
        });
      }));

      // --- car counter ---
      list.appendChild(this.toggleRow(CC.i18n.t('ui.counter'), cfg.showCounter, on => {
        this.set({ showCounter: on });
        this.render();
      }));

      // --- sound ---
      list.appendChild(this.toggleRow(CC.i18n.t('ui.sound'), CC.audio.enabled, on => {
        CC.audio.setEnabled(on);
        this.render();
      }));

      // --- the physical gate ---
      list.appendChild(this.row(CC.i18n.t('ui.device'), (box) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'set-input';
        input.value = CC.gate.address;
        input.placeholder = CC.gate.defaultHost;
        input.spellcheck = false;
        input.autocomplete = 'off';
        box.appendChild(input);

        const test = document.createElement('button');
        test.className = 'set-choice';
        test.textContent = CC.i18n.t('ui.test');
        test.addEventListener('click', () => {
          CC.audio.blip();
          this.status.textContent = CC.i18n.t('ui.deviceSearching');
          CC.gate.testDevice(input.value).then(st => {
            this.status.textContent = st
              ? '✓ ' + CC.i18n.t('ui.deviceOk') + ' (' + st + ')'
              : '✗ ' + CC.i18n.t('ui.deviceFail');
          });
        });
        box.appendChild(test);
      }));

      this.status = document.createElement('div');
      this.status.className = 'set-status';
      list.appendChild(this.status);
      this.deviceStatus();

      const hint = document.createElement('p');
      hint.className = 'set-hint';
      hint.textContent = CC.gate.httpsBlocked
        ? CC.i18n.t('ui.deviceHttps')
        : CC.i18n.t('ui.deviceHint');
      list.appendChild(hint);

      // --- reset the train ---
      const reset = document.createElement('button');
      reset.className = 'set-choice set-wide';
      reset.textContent = '🚂 ' + CC.i18n.t('ui.resetTrain');
      reset.addEventListener('click', () => {
        CC.audio.blip();
        CC.trains.reset();
        CC.speech.praise();
      });
      list.appendChild(reset);

      // --- done ---
      const done = document.createElement('button');
      done.className = 'set-done';
      done.textContent = CC.i18n.t('ui.done') + ' ✓';
      done.addEventListener('click', () => { CC.audio.blip(); this.close(); });
      p.appendChild(done);
    },

    deviceStatus() {
      if (!this.status) return;
      if (CC.gate.httpsBlocked) { this.status.textContent = ''; return; }
      this.status.textContent = CC.gate.connected
        ? '✓ ' + CC.i18n.t('ui.deviceOk') + (CC.gate.address ? ' — ' + CC.gate.address : '')
        : '';
    },

    row(label, fill) {
      const r = document.createElement('div');
      r.className = 'set-row';
      const l = document.createElement('span');
      l.className = 'set-label';
      l.textContent = label;
      r.appendChild(l);
      const box = document.createElement('div');
      box.className = 'set-controls';
      fill(box);
      r.appendChild(box);
      return r;
    },

    toggleRow(label, value, onChange) {
      return this.row(label, (box) => {
        [[true, CC.i18n.t('ui.on')], [false, CC.i18n.t('ui.off')]].forEach(([v, text]) => {
          const b = document.createElement('button');
          b.className = 'set-choice' + (v === !!value ? ' is-on' : '');
          b.textContent = text;
          b.addEventListener('click', () => { CC.audio.blip(); onChange(v); });
          box.appendChild(b);
        });
      });
    },
  };

  CC.settings = settings;
})(window.CC = window.CC || {});
