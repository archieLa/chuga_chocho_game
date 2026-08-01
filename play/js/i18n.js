/* i18n.js — language + text/word dictionaries.
   English is the default; Polish ships day one. Adding a language = adding a
   dictionary object here (data, not code). See DESIGN.md §8.

   Everything a child sees or hears comes from here so it stays translatable.
   If you are about to type a user-facing string anywhere else in the codebase,
   put it here instead.
*/
(function (CC) {
  'use strict';

  const DICT = {
    en: {
      name: 'English',
      flag: '🇬🇧',
      voice: 'en',                // BCP-47 prefix for SpeechSynthesis voice matching
      ui: { close: 'CLOSE', open: 'OPEN', settings: 'Settings', done: 'Done',
            language: 'Language', counter: 'Show car counter', device: 'Real crossing gate',
            map: 'Map', train: 'My train', back: 'Back', pickPlace: 'Where shall we go?',
            engine: 'Engine', wagon: 'Wagon', colour: 'Colour', ride: 'Ride!',
            sound: 'Sound', resetTrain: 'Build my train again', reset: 'Start again',
            test: 'Test', on: 'On', off: 'Off', cars: 'Cars',
            deviceHint: 'Leave this empty and we look for crossinggate.local by ourselves.',
            deviceHttps: 'To use the real gate, open the copy you downloaded to your own computer.',
            deviceOk: 'Connected', deviceFail: 'Not found', deviceSearching: 'Looking…',
            chooseTrain: 'My train', tapAState: 'Tap a coloured state',
            // The welcome screen — the front door. `allAboard` is the one big
            // green button, and it doubles as the gesture that unlocks speech.
            allAboard: 'ALL ABOARD!', readyToRide: 'Ready for an adventure?' },
      // Spoken once when the game opens, over the map. `sayAs` is what the voice is
      // given (the brand sound respelled so this language's TTS pronounces it);
      // `text` is what a reader sees. Keep the brand sound itself untranslated.
      welcome: { text: "Let's explore the United States. Time to ride… chuga chuga choo choo!",
                 sayAs: "Let's explore the United States. Time to ride... chuga chuga choo choo!" },
      colors: { red:'red', blue:'blue', yellow:'yellow', green:'green', purple:'purple', orange:'orange', black:'black' },
      numbers: ['zero','one','two','three','four','five','six','seven','eight','nine','ten'],
      shapes: { circle:'circle', triangle:'triangle', square:'square', star:'star' },
      praise: ['Yay!', 'Great!', 'Wow!', 'Well done!'],
      // Vehicle names as a small child would say them — not the manifest's
      // catalogue labels, which are written for a grown-up reading a spec.
      vehicles: {
        'steam': 'Steam engine', 'diesel': 'Big diesel engine',
        'electric-hs': 'Fast train', 'commuter': 'City train',
        'streetcar': 'Streetcar', 'cable-car': 'Cable car',
        'wagon-coach-old': 'Old carriage', 'wagon-coach-modern': 'New carriage',
        'wagon-boxcar': 'Box wagon', 'wagon-container': 'Container wagon',
        'wagon-hopper': 'Coal wagon', 'wagon-tanker': 'Tank wagon',
        'wagon-hs-coach': 'Fast carriage', 'wagon-caboose': 'Little red caboose',
      },
      // Place names spoken on the map come from world.js.
    },
    pl: {
      name: 'Polski',
      flag: '🇵🇱',
      voice: 'pl',
      ui: { close: 'ZAMKNIJ', open: 'OTWÓRZ', settings: 'Ustawienia', done: 'Gotowe',
            language: 'Język', counter: 'Pokaż licznik aut', device: 'Prawdziwy szlaban',
            map: 'Mapa', train: 'Mój pociąg', back: 'Wróć', pickPlace: 'Dokąd jedziemy?',
            engine: 'Lokomotywa', wagon: 'Wagon', colour: 'Kolor', ride: 'Jedziemy!',
            sound: 'Dźwięk', resetTrain: 'Zbuduj pociąg od nowa', reset: 'Od nowa',
            test: 'Sprawdź', on: 'Włączony', off: 'Wyłączony', cars: 'Auta',
            deviceHint: 'Zostaw puste — sami poszukamy crossinggate.local.',
            deviceHttps: 'Aby użyć prawdziwego szlabanu, otwórz kopię pobraną na swój komputer.',
            deviceOk: 'Połączono', deviceFail: 'Nie znaleziono', deviceSearching: 'Szukam…',
            chooseTrain: 'Mój pociąg', tapAState: 'Dotknij kolorowego stanu',
            // "Wsiadamy" is what you actually say to a child boarding a train —
            // not a literal translation of "all aboard".
            allAboard: 'WSIADAMY!', readyToRide: 'Gotowi na przygodę?' },
      welcome: { text: 'Zwiedzajmy Stany Zjednoczone. Czas na przejażdżkę… chuga chuga choo choo!',
                 sayAs: 'Zwiedzajmy Stany Zjednoczone. Czas na przejażdżkę... czuga czuga czu czu!' },
      colors: { red:'czerwony', blue:'niebieski', yellow:'żółty', green:'zielony', purple:'fioletowy', orange:'pomarańczowy', black:'czarny' },
      numbers: ['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć','dziesięć'],
      shapes: { circle:'koło', triangle:'trójkąt', square:'kwadrat', star:'gwiazda' },
      praise: ['Brawo!', 'Super!', 'Wow!', 'Świetnie!'],
      vehicles: {
        'steam': 'Parowóz', 'diesel': 'Duża lokomotywa',
        'electric-hs': 'Szybki pociąg', 'commuter': 'Pociąg miejski',
        'streetcar': 'Tramwaj', 'cable-car': 'Kolejka linowa',
        'wagon-coach-old': 'Stary wagon', 'wagon-coach-modern': 'Nowy wagon',
        'wagon-boxcar': 'Wagon kryty', 'wagon-container': 'Wagon z kontenerem',
        'wagon-hopper': 'Wagon z węglem', 'wagon-tanker': 'Cysterna',
        'wagon-hs-coach': 'Szybki wagon', 'wagon-caboose': 'Wagon konduktora',
      },
    },
    // Spanish (and others) come in a later phase — copy the shape above.
  };

  const STORAGE_KEY = 'cc.lang';
  let current = localStorage.getItem(STORAGE_KEY) || 'en';   // English default
  if (!DICT[current]) current = 'en';

  const i18n = {
    get code() { return current; },
    get dict() { return DICT[current]; },
    languages() { return Object.keys(DICT).map(k => ({ code: k, name: DICT[k].name, flag: DICT[k].flag })); },

    set(code) {
      if (!DICT[code] || code === current) return;
      current = code;
      localStorage.setItem(STORAGE_KEY, code);
      document.documentElement.lang = code;
      this.apply();
      CC.emit && CC.emit('languagechange', code);
    },

    /** t('ui.close') → localized string, falling back to English then the key. */
    t(path) {
      const get = (obj) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
      const v = get(DICT[current]);
      return v != null ? v : (get(DICT.en) != null ? get(DICT.en) : path);
    },

    /** The child-friendly name of a vehicle, e.g. 'Little red caboose'. */
    vehicle(type) { return this.t('vehicles.' + type) || type; },

    /** 'one' … 'ten' — used to say which wagon is being edited. */
    number(n) { const l = this.dict.numbers || []; return l[n] != null ? l[n] : String(n); },

    /** Fill any element with data-i18n="close" style keys (relative to `ui`). */
    apply(root) {
      (root || document).querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = this.t('ui.' + el.getAttribute('data-i18n'));
      });
      (root || document).querySelectorAll('[data-i18n-title]').forEach(el => {
        const s = this.t('ui.' + el.getAttribute('data-i18n-title'));
        el.setAttribute('title', s);
        el.setAttribute('aria-label', s);
      });
    },
  };

  document.documentElement.lang = current;
  CC.i18n = i18n;
})(window.CC = window.CC || {});
