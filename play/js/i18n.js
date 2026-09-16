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
            surprise: 'Surprise me!', nextStop: 'Next stop', allSeen: 'We have seen them all! Round we go again.',
            engine: 'Engine', wagon: 'Wagon', colour: 'Colour', ride: 'Ride!',
            sound: 'Sound', resetTrain: 'Build my train again', reset: 'Start again',
            test: 'Test', on: 'On', off: 'Off', cars: 'Cars',
            deviceHint: 'Leave this empty and we look for crossinggate.local by ourselves.',
            deviceHttps: 'To use the real gate, open the copy you downloaded to your own computer.',
            deviceOk: 'Connected', deviceFail: 'Not found', deviceSearching: 'Looking…',
            chooseTrain: 'My train', tapAState: 'Tap a coloured state',
            // The welcome screen — the front door. `allAboard` is the one big
            // green button, and it doubles as the gesture that unlocks speech.
            allAboard: 'ALL ABOARD!', readyToRide: 'Ready for an adventure?',
            // Shown when the device is held upright. The picture does the work —
            // this is spoken, not read.
            rotate: 'Turn me sideways!' },
      // Spoken once when the game opens, over the map. `sayAs` is what the voice is
      // given (the brand sound respelled so this language's TTS pronounces it);
      // `text` is what a reader sees. Keep the brand sound itself untranslated.
      welcome: { text: "Let's explore the United States. Time to ride… chuga chuga choo choo!",
                 sayAs: "Let's explore the United States. Time to ride... chuga chuga choo choo!" },
      colors: { red:'red', blue:'blue', yellow:'yellow', green:'green', purple:'purple', orange:'orange', black:'black', flag:'stars and stripes' },
      numbers: ['zero','one','two','three','four','five','six','seven','eight','nine','ten'],
      shapes: { circle:'circle', triangle:'triangle', square:'square', star:'star' },
      praise: ['Yay!', 'Great!', 'Wow!', 'Well done!'],
      // Vehicle names in a child's words, EXCEPT where the real name is the
      // point. A three-year-old who loves trains would rather be told this is a
      // diesel-electric engine than a "big diesel engine", and will say it back —
      // so the two engines whose names describe how they actually work use the
      // proper term in both languages. The rest stay plain ("Little red caboose"),
      // and none of them are the manifest's catalogue labels, which are written
      // for a grown-up reading a spec.
      // These are SPOKEN, so editing one makes the recordings stale — run
      // tools/check-voice.py, which will tell you so, then tools/gen-voice.py.
      vehicles: {
        'steam': 'Steam engine', 'diesel': 'Diesel-electric engine',
        'electric-hs': 'Electric train', 'commuter': 'City train',
        'streetcar': 'Streetcar', 'cable-car': 'Cable car',
        'wagon-coach-old': 'Old carriage', 'wagon-coach-modern': 'New carriage',
        'wagon-boxcar': 'Box wagon', 'wagon-container': 'Container wagon',
        'wagon-hopper': 'Coal wagon', 'wagon-tanker': 'Tank wagon',
        'wagon-hs-coach': 'Fast carriage', 'wagon-caboose': 'Little red caboose',
        'cane-tank': 'Little tank engine', 'wagon-cane': 'Sugar cane wagon',
        'monorail': 'Monorail', 'wagon-monorail': 'Monorail carriage',
        'wagon-autorack': 'Car carrier',
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
            surprise: 'Niespodzianka!', nextStop: 'Następny przystanek', allSeen: 'Zwiedziliśmy wszystkie! Jedziemy jeszcze raz.',
            engine: 'Lokomotywa', wagon: 'Wagon', colour: 'Kolor', ride: 'Jedziemy!',
            sound: 'Dźwięk', resetTrain: 'Zbuduj pociąg od nowa', reset: 'Od nowa',
            test: 'Sprawdź', on: 'Włączony', off: 'Wyłączony', cars: 'Auta',
            deviceHint: 'Zostaw puste — sami poszukamy crossinggate.local.',
            deviceHttps: 'Aby użyć prawdziwego szlabanu, otwórz kopię pobraną na swój komputer.',
            deviceOk: 'Połączono', deviceFail: 'Nie znaleziono', deviceSearching: 'Szukam…',
            chooseTrain: 'Mój pociąg', tapAState: 'Dotknij kolorowego stanu',
            // "Wsiadamy" is what you actually say to a child boarding a train —
            // not a literal translation of "all aboard".
            allAboard: 'WSIADAMY!', readyToRide: 'Gotowi na przygodę?',
            rotate: 'Obróć mnie na bok!' },
      welcome: { text: 'Zwiedzajmy Stany Zjednoczone. Czas na przejażdżkę… chuga chuga choo choo!',
                 sayAs: 'Zwiedzajmy Stany Zjednoczone. Czas na przejażdżkę... czuga czuga czu czu!' },
      colors: { red:'czerwony', blue:'niebieski', yellow:'żółty', green:'zielony', purple:'fioletowy', orange:'pomarańczowy', black:'czarny', flag:'gwiazdy i paski' },
      numbers: ['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć','dziesięć'],
      shapes: { circle:'koło', triangle:'trójkąt', square:'kwadrat', star:'gwiazda' },
      praise: ['Brawo!', 'Super!', 'Wow!', 'Świetnie!'],
      // ---- PHONETIC RESPELLINGS FOR THE VOICE --------------------------------
      // What the voice is FED, never what the screen SHOWS. Keyed by the text as
      // this language displays it.
      //
      // WHY: the narrator never changes language mid-session (see world.spoken()),
      // so the Polish voice says the American names too — and fed the English
      // SPELLING it gets them wrong, because it applies Polish letter rules.
      // "Massachusetts" came out as "masachutes". Respelled "Masaczusets", it is
      // right. This is the same trick as welcome.sayAs turning "choo choo" into
      // "czu czu"; there is just more of it.
      //
      // Two kinds of entry, deliberately mixed:
      //   · a PHONETIC respelling where Polish has no name of its own
      //     (Seattle → Siatl, Wisconsin → Łiskonsin)
      //   · the REAL POLISH NAME where one exists, because a Polish child should
      //     hear the word Polish actually uses (California → Kalifornia,
      //     Texas → Teksas, North Dakota → Dakota Północna). The map still shows
      //     the English name; only the voice differs.
      //
      // A name already said correctly is simply absent — Alabama, Boston, Denali,
      // Montana, Nebraska, Oklahoma, Oregon, Indiana, Alaska, Moab, Oahu.
      // Check a new one by EAR before adding it, with tools/voice/venv/bin/piper.
      sayAs: {
        // --- places -------------------------------------------------------
        'San Francisco':'San Francysko',
        'Los Angeles':'Los Andżeles', 'Chicago':'Szikago', 'Seattle':'Sijatyl',
        'Austin':'Ałstin', 'Houston':'Hjuston', 'Cape Canaveral':'Kejp Kanewral',
        'Las Vegas':'Las Wegas', 'Nashville':'Naszwil', 'Yellowstone':'Jelołston',
        'Miami Beach':'Majami Bicz', 'Duluth':'Dulut', 'Kansas City':'Kanzas Syti',
        'Cedar Point':'Sidar Pojnt', 'Savannah':'Sawanna', 'Stonington':'Stoningtyn',
        'Albuquerque':'Albekerki', 'Cape Hatteras':'Kejp Hateras', 'Quechee':'Kłiczi',
        'Detroit':'Ditrojit', 'New River Gorge':'Niu Riwer Gordż',
        'Vicksburg':'Wiksburg', 'Charleston':'Czarlston',
        'Glacier':'Glejszer', 'Newport':'Niuport', 'Mystic':'Mystik',
        'Bailey Yard':'Bejli Jard', 'Bentonville':'Bentonwil', 'Birmingham':'Birmingam',
        'Oklahoma City':'Oklahoma Syti', 'Wisconsin Dells':'Łiskansyn Dels',
        'Dubuque':'Dubjuk', 'Lewes':'Luis', 'Norfolk':'Norfok',
        'Margate City':'Margejt Syti', 'Wyspa Assateague':'Wyspa Asatig',
        // --- states -------------------------------------------------------
        'Arkansas':'Arkanzas', 'California':'Kalifornia', 'Colorado':'Kolorado',
        'Connecticut':'Konektykat', 'Delaware':'Delałer',
        'District of Columbia':'Dystrykt Kolumbii', 'Florida':'Floryda',
        'Georgia':'Dżordżia', 'Hawaii':'Hawaje', 'Idaho':'Ajdaho',
        'Illinois':'Ilinoj', 'Iowa':'Ajoła', 'Kansas':'Kanzas', 'Kentucky':'Kentaki',
        'Louisiana':'Luizjana', 'Maine':'Mejn', 'Maryland':'Merylend',
        'Massachusetts':'Masaciusets', 'Michigan':'Miszygan', 'Minnesota':'Minesota',
        'Mississippi':'Misysypi', 'Missouri':'Mizuri', 'Nevada':'Newada',
        'New Hampshire':'Niu Hampszyr', 'New Jersey':'Niu Dżerzi',
        'New Mexico':'Nowy Meksyk', 'New York':'Nowy Jork',
        'North Carolina':'Karolina Północna', 'North Dakota':'Dakota Północna',
        'Ohio':'Ohajo', 'Pennsylvania':'Pensylwania', 'Rhode Island':'Rod Ajlend',
        'South Carolina':'Karolina Południowa', 'South Dakota':'Dakota Południowa',
        'Tennessee':'Tenessi', 'Texas':'Teksas', 'Utah':'Juta', 'Vermont':'Wermont',
        'Virginia':'Wirdżinia', 'Washington':'Waszyngton',
        'West Virginia':'Wirdżinia Zachodnia', 'Wisconsin':'Łiskansyn',
        'Wyoming':'Łajoming',
      },
      vehicles: {
        'steam': 'Parowóz', 'diesel': 'Lokomotywa spalinowo-elektryczna',
        'electric-hs': 'Pociąg elektryczny', 'commuter': 'Pociąg miejski',
        'streetcar': 'Tramwaj', 'cable-car': 'Kolejka linowa',
        'wagon-coach-old': 'Stary wagon', 'wagon-coach-modern': 'Nowy wagon',
        'wagon-boxcar': 'Wagon kryty', 'wagon-container': 'Wagon z kontenerem',
        'wagon-hopper': 'Wagon z węglem', 'wagon-tanker': 'Cysterna',
        'wagon-hs-coach': 'Szybki wagon', 'wagon-caboose': 'Wagon konduktora',
        'cane-tank': 'Mała lokomotywka', 'wagon-cane': 'Wagon z trzciną',
        'monorail': 'Kolejka jednoszynowa', 'wagon-monorail': 'Wagon jednoszynowy',
        'wagon-autorack': 'Wagon z autami',
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
    /** A vehicle's name in the active language.

        NOT via t(), which returns the PATH when a key is missing — so a vehicle
        with no entry put the literal "vehicles.cane-tank" on the button and, far
        worse, read it out to the child. Four of the eighteen were in that state.

        This falls back to English, then to a readable form of the id, and warns.
        The warning matters: tools/shot.py exits non-zero on any console warning,
        so adding rolling stock without naming it now fails the check rather than
        reaching a three-year-old's ears. */
    vehicle(type) {
      const named = (DICT[current].vehicles || {})[type] || (DICT.en.vehicles || {})[type];
      if (named) return named;
      console.warn('i18n: no name for vehicle "' + type + '"');
      return String(type).replace(/^wagon-/, '').replace(/-/g, ' ');
    },

    /** 'one' … 'ten' — used to say which wagon is being edited. */
    number(n) { const l = this.dict.numbers || []; return l[n] != null ? l[n] : String(n); },

    /** What the VOICE should be fed for a displayed name — the phonetic
        respelling if this language has one, otherwise the name unchanged.

        Only the voice: callers pass what is on screen and get back what to say.
        English needs no table (the names are English already), so this is a
        no-op there and stays a no-op for any language that does not add one. */
    sayAs(text, code) {
      const d = DICT[code || current] || DICT.en;
      return (d.sayAs && d.sayAs[text]) || text;
    },

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
