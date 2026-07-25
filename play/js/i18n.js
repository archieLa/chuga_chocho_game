/* i18n.js — language + text/word dictionaries.
   English is the default; Polish ships day one. Adding a language = adding a
   dictionary object here (data, not code). See DESIGN.md §8.

   Everything a child sees or hears should come from here so it stays translatable.
*/
(function (CC) {
  'use strict';

  const DICT = {
    en: {
      name: 'English',
      voice: 'en',                // BCP-47 prefix for SpeechSynthesis voice matching
      ui: { close: 'CLOSE', open: 'OPEN', settings: 'Settings', done: 'Done',
            language: 'Language', counter: 'Show car counter', device: 'Physical gate' },
      colors: { red:'red', blue:'blue', yellow:'yellow', green:'green', purple:'purple', orange:'orange' },
      numbers: ['zero','one','two','three','four','five','six','seven','eight','nine','ten'],
      shapes: { circle:'circle', triangle:'triangle', square:'square', star:'star' },
      praise: ['Yay!', 'Great!', 'Wow!', 'Well done!'],
      // Place names spoken on the map get added alongside world.js locations.
    },
    pl: {
      name: 'Polski',
      voice: 'pl',
      ui: { close: 'ZAMKNIJ', open: 'OTWÓRZ', settings: 'Ustawienia', done: 'Gotowe',
            language: 'Język', counter: 'Pokaż licznik aut', device: 'Fizyczna brama' },
      colors: { red:'czerwony', blue:'niebieski', yellow:'żółty', green:'zielony', purple:'fioletowy', orange:'pomarańczowy' },
      numbers: ['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć','dziesięć'],
      shapes: { circle:'koło', triangle:'trójkąt', square:'kwadrat', star:'gwiazda' },
      praise: ['Brawo!', 'Super!', 'Wow!', 'Świetnie!'],
    },
    // Spanish (and others) come in a later phase — copy the shape above.
  };

  const STORAGE_KEY = 'cc.lang';
  let current = localStorage.getItem(STORAGE_KEY) || 'en';   // English default
  if (!DICT[current]) current = 'en';

  const i18n = {
    get code() { return current; },
    get dict() { return DICT[current]; },
    languages() { return Object.keys(DICT).map(k => ({ code: k, name: DICT[k].name })); },

    set(code) {
      if (!DICT[code]) return;
      current = code;
      localStorage.setItem(STORAGE_KEY, code);
      this.apply();
      CC.emit && CC.emit('languagechange', code);
    },

    /** t('ui.close') → localized string, falling back to English then the key. */
    t(path) {
      const get = (obj) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
      const v = get(DICT[current]);
      return v != null ? v : (get(DICT.en) != null ? get(DICT.en) : path);
    },

    /** Fill any element with data-i18n="ui.close" style keys. */
    apply(root) {
      (root || document).querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = this.t('ui.' + el.getAttribute('data-i18n'));
      });
    },
  };

  CC.i18n = i18n;
})(window.CC = window.CC || {});
