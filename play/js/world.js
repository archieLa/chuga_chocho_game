/* world.js — locations (the geography system). See DESIGN.md §6.
   A location is a DESTINATION: a city (San Francisco) or a natural place
   (Rocky Mountains). It is never just the state name repeated. How many
   destinations a state has follows how many visually distinct looks it has —
   California has two, Colorado has one (for now). The interaction is what stays
   uniform: tap a state -> full name -> pick a destination.
   A location is DATA that scene.js renders, so adding a place = adding an entry
   here (+ art). Place names are spoken in the active language when selected.

   Phase 1.4: implement at least 2 locations end-to-end (Colorado, San Francisco).
   Phase 1.5: the US-map picker chooses among these.
*/
(function (CC) {
  'use strict';

  // Each location: id, state, city (optional), spoken names per language,
  // a scenery descriptor (consumed by scene.js), and a suggested train preset.
  const LOCATIONS = [
    { id:'colorado',   state:'Colorado',   city:'Rocky Mountains',
      say:{ en:'Rocky Mountains', pl:'Rocky Mountains' },
      scene:'colorado',
      scenery:{ theme:'mountains', features:['peaks','aspens','trestle','creek','redrock'] },
      trainPreset:{ engine:'steam' } },

    { id:'sf', state:'California', city:'San Francisco',
      say:{ en:'San Francisco', pl:'San Francisco' },
      scene:'sf',
      scenery:{ theme:'bridge', features:['goldengate','paintedladies','lombard','bay','fog'] },
      trainPreset:{ engine:'cable-car' } },

    { id:'la', state:'California', city:'Los Angeles',
      say:{ en:'Los Angeles', pl:'Los Angeles' },
      scene:'la',
      scenery:{ theme:'beach', features:['ocean','sand','musclebeach','volleyball','palms','hollywood'] },
      trainPreset:{ engine:'commuter' } },

    { id:'chicago',    state:'Illinois',   city:'Chicago',       say:{ en:'Chicago', pl:'Chicago' },           scene:'chicago', scenery:{ theme:'city',    features:['skyline','L','tunnel','lake'] },   trainPreset:{ engine:'commuter' } },
    { id:'arizona',    state:'Arizona',    city:'Grand Canyon',  say:{ en:'Grand Canyon', pl:'Wielki Kanion' }, scene:'grand-canyon', scenery:{ theme:'canyon',  features:['canyonwalls','mesas','rimpines','saguaro'] }, trainPreset:{ engine:'diesel' } },
    { id:'nyc',        state:'New York',   city:'New York City', say:{ en:'New York City', pl:'Nowy Jork' },   scene:'nyc', scenery:{ theme:'city',    features:['brooklynbridge','subway'] },      trainPreset:{ engine:'commuter' } },
    { id:'seattle',    state:'Washington', city:'Seattle',       say:{ en:'Seattle', pl:'Seattle' },           scene:'seattle', scenery:{ theme:'cascades',features:['evergreens','ferry','mountains'] },trainPreset:{ engine:'commuter' } },
    { id:'austin', state:'Texas', city:'Austin',
      say:{ en:'Austin', pl:'Austin' },
      scene:'austin',
      scenery:{ theme:'dusk-city', features:['bats','congressbridge','capitol','ladybirdlake','foodtrucks'] },
      trainPreset:{ engine:'commuter' } },

    { id:'houston', state:'Texas', city:'Houston',
      say:{ en:'Houston', pl:'Houston' },
      scene:'houston',
      scenery:{ theme:'space', features:['shuttle','boeing747','saturnv','liveoaks','refinery'] },
      trainPreset:{ engine:'diesel' } },

    { id:'cape', state:'Florida', city:'Cape Canaveral',
      say:{ en:'Cape Canaveral', pl:'Cape Canaveral' },
      scene:'cape-canaveral',
      scenery:{ theme:'space-coast', features:['rocket','vab','lagoon','saltmarsh','gator','palmetto'] },
      trainPreset:{ engine:'diesel' } },

    { id:'oahu', state:'Hawaii', city:'O\u02bbahu',
      say:{ en:'Oahu', pl:'Oahu' },
      scene:'oahu',
      scenery:{ theme:'island', features:['diamondhead','reef','waikiki','outrigger','palms','hula'] },
      trainPreset:{ engine:'cane-tank' } },

    { id:'denali', state:'Alaska', city:'Denali',
      say:{ en:'Denali', pl:'Denali' },
      scene:'denali',
      // The view is the real one: the Alaska Range from the Susitna flats near
      // Talkeetna, where the Alaska Railroad runs. Night, aurora, September.
      scenery:{ theme:'aurora', features:['alaskarange','aurora','spruce','susitna','moose','cabin'] },
      // Alaska Railroad livery is a recolour of the diesel — blue and gold.
      trainPreset:{ engine:'diesel' } },

    { id:'vegas', state:'Nevada', city:'Las Vegas',
      say:{ en:'Las Vegas', pl:'Las Vegas' },
      scene:'las-vegas',
      scenery:{ theme:'night-city', features:['neon','welcomesign','strip','palms','desertmountains'] },
      // The game's only NIGHT scene — if a day/night tint or ambient audio is ever
      // added, this is the one that will show it.
      trainPreset:{ engine:'monorail' } },

    { id:'moab', state:'Utah', city:'Moab',
      say:{ en:'Moab', pl:'Moab' },
      scene:'moab',
      // Viewpoint: Delicate Arch from the slickrock bowl below it, La Sals behind.
      scenery:{ theme:'redrock', features:['delicatearch','slickrock','lasals','juniper','jeep'] },
      trainPreset:{ engine:'diesel' } },

    { id:'nashville', state:'Tennessee', city:'Nashville',
      say:{ en:'Nashville', pl:'Nashville' },
      scene:'nashville',
      // Viewpoint: Lower Broadway looking west, late afternoon — honky tonk neon on
      // Victorian commercial brick, downtown and the AT&T building stacked up behind.
      scenery:{ theme:'city', features:['honkytonks','neon','batmanbuilding','busker'] },
      trainPreset:{ engine:'diesel' } },

    { id:'boston', state:'Massachusetts', city:'Boston',
      say:{ en:'Boston', pl:'Boston' },
      scene:'boston',
      // Viewpoint: Back Bay across the Charles from the Cambridge bank, early autumn.
      // The engine is the Green Line, which is why no trolley is drawn into the scene.
      scenery:{ theme:'river', features:['backbay','hancock','charles','esplanade','bridge'] },
      trainPreset:{ engine:'streetcar', bodyColour:'#2f7d4a' } },

    { id:'yellowstone', state:'Wyoming', city:'Yellowstone',
      say:{ en:'Yellowstone', pl:'Yellowstone' },
      scene:'yellowstone',
      // Viewpoint: the LAMAR VALLEY, not the Upper Geyser Basin — the Absaroka wall above a
      // golden sage flat, the Lower Falls cut into the foothills, and the thermal ground
      // pushed to the right, clear of the crossing. (The handoff's own §6 says this; the
      // comment shipped with the entry described the basin version that was abandoned.)
      // First scene with an animal population — the bison herd and elk are static art.
      scenery:{ theme:'valley', features:['absaroka','bison','elk','lowerfalls','geyser','sinter'] },
      trainPreset:{ engine:'steam' } },

    { id:'dc', state:'District of Columbia', city:'Washington',
      // Shown as "Washington"; spoken as "Washington D C" so the voice reads the
      // letters instead of slurring them. See world.spoken().
      say:{ en:'Washington', pl:'Waszyngton' },
      sayAs:{ en:'Washington D C' },
      // The district IS the place. Everywhere else gets its state announced with
      // it — "Nebraska. Bailey Yard." — but "District of Columbia. Washington
      // D C." is the same answer given twice, and the second half already spells
      // out the first. See world.spokenState().
      stateIsPlace:true,
      scene:'washington-dc',
      // Viewpoint: the Tidal Basin at peak cherry blossom. The Capitol is small and distant
      // on purpose — from here that is where it actually is.
      scenery:{ theme:'monumental', features:['jefferson','monument','capitol','cherryblossom'] },
      trainPreset:{ engine:'commuter' } },

    { id:'miami', state:'Florida', city:'Miami Beach',
      say:{ en:'Miami Beach', pl:'Miami Beach' },
      scene:'miami-beach',
      // Viewpoint: Ocean Drive looking north — the set's first asymmetric composition,
      // Deco row and palms left, beach and Atlantic right.
      scenery:{ theme:'deco-beach', features:['artdeco','lifeguardtowers','palms','atlantic'] },
      trainPreset:{ engine:'commuter' } },

    { id:'duluth', state:'Minnesota', city:'Duluth',
      say:{ en:'Duluth', pl:'Duluth' },
      scene:'duluth',
      // Viewpoint: Canal Park looking north through the Aerial Lift Bridge. The road crosses
      // ON the bridge — and the whole span goes up and down, which is the joke of the place.
      scenery:{ theme:'harbour', features:['liftbridge','orefreighter','lighthouse','pines'] },
      trainPreset:{ engine:'diesel' } },

    { id:'kansas', state:'Kansas', city:'Wheat Country',
      // Short enough to be the same shown and spoken — "Kansas wheat country"
      // was a sentence fragment, not a name a three-year-old repeats back.
      say:{ en:'Wheat Country', pl:'Pola pszenicy' },
      scene:'kansas',
      // Viewpoint: a section road beside the elevator siding. The SKY is the subject here —
      // it is the only scene in the set with nothing standing in front of it.
      scenery:{ theme:'plains', features:['grainelevator','cumulus','windmill','sunflowers'] },
      trainPreset:{ engine:'diesel' } },

    { id:'kansascity', state:'Missouri', city:'Kansas City',
      say:{ en:'Kansas City', pl:'Kansas City' },
      scene:'kansas-city',
      // Viewpoint: Union Station seen from the Liberty Memorial lawn. Of every building in
      // the game this is the one most about trains.
      scenery:{ theme:'civic', features:['unionstation','libertymemorial','fountain','skyline'] },
      trainPreset:{ engine:'diesel' } },

    { id:'smokies', state:'Tennessee', city:'Gatlinburg',
      // "Smoky Mountains", not "the Great Smoky Mountains" — short names are what
      // a small child can hear once and say back.
      say:{ en:'Smoky Mountains', pl:'Góry Dymne' },
      scene:'smokies',
      // Viewpoint: the Parkway at the foot of the range. The hero is atmosphere: six ridges
      // receding, each paler than the one in front, with fog lying IN the valleys between.
      scenery:{ theme:'appalachian', features:['ridges','spaceneedle','skylift','blackbear'] },
      trainPreset:{ engine:'steam' } },

    { id:'horseshoe', state:'Pennsylvania', city:'Horseshoe Curve',
      say:{ en:'Horseshoe Curve', pl:'Zakręt Podkowa' },
      scene:'horseshoe-curve',
      // Viewpoint: the floor of the valley at Kittanning Point, looking up. The line runs
      // round the bowl ABOVE eye level, so it reads as a long sagging arch and the road
      // passes underneath it. The only scene in the set where the railway is the landmark.
      scenery:{ theme:'appalachian-rail', features:['thecurve','reservoir','signals','hardwood'] },
      trainPreset:{ engine:'diesel' } },

    { id:'craterlake', state:'Oregon', city:'Crater Lake',
      say:{ en:'Crater Lake', pl:'Jezioro Kraterowe' },
      scene:'crater-lake',
      // Viewpoint: Rim Drive. Asymmetric on purpose — the caldera opens left and the rim
      // climbs right, so the road has somewhere to go instead of running into the water.
      scenery:{ theme:'caldera', features:['wizardisland','calderawall','whitebark','rimlodge'] },
      trainPreset:{ engine:'commuter' } },

    { id:'bluegrass', state:'Kentucky', city:'Bluegrass',
      // Short name, shown and spoken the same — same call as Wheat Country and
      // Smoky Mountains. "the Kentucky bluegrass" is a sentence, not a label,
      // and it matches `city` and the map's SUPPORTED entry this way.
      say:{ en:'Bluegrass', pl:'Pastwiska' },
      scene:'bluegrass',
      // Viewpoint: a farm's limestone drive outside Lexington, so the "road" is gravel.
      // The first scene in the set with animals a child can name outside a national park.
      scenery:{ theme:'horse-farm', features:['plankfence','showbarn','thoroughbreds','stonewall'] },
      trainPreset:{ engine:'steam' } },

    { id:'mtwashington', state:'New Hampshire', city:'Mount Washington',
      say:{ en:'Mount Washington', pl:'Góra Waszyngtona' },
      scene:'mt-washington',
      // Viewpoint: the road at Marshfield, looking straight up the mountain. The steepest
      // thing in the set — the cog line is ruled up a bare dome and the engine PUSHES its
      // coach, boiler tilted back so it sits level on the grade.
      scenery:{ theme:'alpine-cog', features:['cogline','jacobsladder','marshfield','treeline'] },
      trainPreset:{ engine:'steam' } },

    { id:'cedarpoint', state:'Ohio', city:'Cedar Point',
      // No Polish form — it is a proper noun. spoken() will hand this to an
      // English voice rather than letting a Polish one mangle it.
      say:{ en:'Cedar Point', pl:'Cedar Point' },
      scene:'cedar-point',
      // Viewpoint: the brick midway, looking across the park railroad at the coasters. The
      // most colourful scene in the game, and the only one where the level crossing is a
      // real thing that is really there — the park has its own narrow-gauge line.
      scenery:{ theme:'fairground', features:['coasters','midway','parkrailroad','lakeerie'] },
      trainPreset:{ engine:'steam' } },

    { id:'savannah', state:'Georgia', city:'Savannah',
      say:{ en:'Savannah', pl:'Savannah' },
      scene:'savannah',
      // Viewpoint: a street through one of the historic squares. The first scene whose hero
      // is a TREE — live oaks hung with Spanish moss standing in the square. (An overhead
      // canopy arching across the top of the frame was tried during authoring and CUT: every
      // other scene looks *at* its subject, and a leaf frame read as decoration pasted on.)
      scenery:{ theme:'lowcountry', features:['liveoaks','spanishmoss','rowhouses','square'] },
      trainPreset:{ engine:'streetcar' } },

    { id:'stonington', state:'Maine', city:'Stonington',
      say:{ en:'Stonington', pl:'Stonington' },
      scene:'stonington',
      // Viewpoint: the road down to the town landing on Deer Isle, which STOPS at the car
      // park — the harbour is beyond it. A town wrapped round a basin, and the first cold
      // WORKING coast in the set against three warm holiday ones: the colour comes from the
      // gear (traps, pot buoys, oilskins), not from the houses.
      scenery:{ theme:'downeast', features:['lobsterboats','fishhouses','traps','granite'] },
      trainPreset:{ engine:'diesel' } },

    { id:'albuquerque', state:'New Mexico', city:'Albuquerque',
      say:{ en:'Albuquerque', pl:'Albuquerque' },
      scene:'albuquerque',
      // Viewpoint: the balloon fiesta launch field at dawn. The first scene where the SKY is
      // the subject rather than the backdrop — forty balloons above the city, the Sandia wall
      // behind, the cottonwood bosque along the Rio Grande between them.
      scenery:{ theme:'highdesert', features:['balloons','sandias','bosque','adobe','launchfield'] },
      trainPreset:{ engine:'diesel' } },

    { id:'hatteras', state:'North Carolina', city:'Cape Hatteras',
      say:{ en:'Cape Hatteras', pl:'Cape Hatteras' },
      scene:'cape-hatteras',
      // Viewpoint: the road down to the dune crossing, which STOPS at the car park — a
      // boardwalk goes over the top and nothing drives onto the beach. The set's first
      // lighthouse, and a working Atlantic rather than a holiday one.
      scenery:{ theme:'outerbanks', features:['lighthouse','dunes','seaoats','sandfence','atlantic'] },
      trainPreset:{ engine:'diesel' } },

    { id:'quechee', state:'Vermont', city:'Quechee',
      say:{ en:'Quechee', pl:'Quechee' },
      scene:'quechee',
      // Viewpoint: the road down to the covered bridge, which it runs straight INTO — the
      // most Vermont thing a road can do. The set's first autumn palette, first waterfall
      // and first mill, and the hero is the hillside rather than the falls.
      scenery:{ theme:'autumn', features:['falls','mill','coveredbridge','maples','stonewalls'] },
      trainPreset:{ engine:'steam' } },

    { id:'detroit', state:'Michigan', city:'Detroit',
      say:{ en:'Detroit', pl:'Detroit' },
      scene:'detroit',
      // Viewpoint: the road up to the plant gate, where it stops — you do not drive onto a
      // shipping lot. The set's first factory, and the one place where the railway is part
      // of the SUBJECT rather than scenery beside it: the siding exists to load cars.
      scenery:{ theme:'industrial', features:['assemblyplant','shippinglot','autoracks','skyline'] },
      trainPreset:{ engine:'diesel' } },

    { id:'sunvalley', state:'Idaho', city:'Sun Valley',
      say:{ en:'Sun Valley', pl:'Sun Valley' },
      scene:'sun-valley',
      // Viewpoint: the road into Ketchum, which STOPS at the main street. The set's first
      // winter scene and its first aerial lift — Bald Mountain is a whaleback, and the ski
      // runs are the gaps the timber leaves, which is how runs are actually cut.
      scenery:{ theme:'winter', features:['baldmountain','gondola','chairlift','skiers','ketchum'] },
      trainPreset:{ engine:'diesel' } },

    { id:'indianapolis', state:'Indiana', city:'Indianapolis',
      say:{ en:'Indianapolis', pl:'Indianapolis' },
      scene:'indianapolis',
      // Viewpoint: outside the main straight, which is the only place a level crossing could
      // plausibly be. The road is the track ACCESS road — it carries on through the gate as a
      // paved apron onto the racing surface, so the traffic has somewhere to be going.
      scenery:{ theme:'motorsport', features:['mainstraight','pitlane','pagoda','grandstand'] },
      trainPreset:{ engine:'diesel' } },

    { id:'newrivergorge', state:'West Virginia', city:'New River Gorge',
      say:{ en:'New River Gorge', pl:'New River Gorge' },
      scene:'new-river-gorge',
      // Viewpoint: the canyon FLOOR at Fayette Station, not the rim — from the rim the road
      // and the railway are a thousand feet below you and there is no scene. The walls climb
      // out of both edges and the arch crosses the wedge of sky between them, 876 feet up.
      scenery:{ theme:'gorge', features:['archbridge','canyonwalls','rapids','fayettestation'] },
      trainPreset:{ engine:'diesel' } },

    { id:'mountrushmore', state:'South Dakota', city:'Mount Rushmore',
      say:{ en:'Mount Rushmore', pl:'Mount Rushmore' },
      scene:'mount-rushmore',
      // Viewpoint: Keystone, looking up at the carving — which is deliberately only a
      // quarter of the frame wide. This is the Black Hills WITH Rushmore in them, not a
      // portrait of four faces. The crossing is the 1880 Train's terminus, and that railroad
      // hauled the equipment that carved the mountain behind it.
      scenery:{ theme:'blackhills', features:['carving','keystone','flagavenue','ponderosa'] },
      trainPreset:{ engine:'steam' } },

    { id:'vicksburg', state:'Mississippi', city:'Vicksburg',
      say:{ en:'Vicksburg', pl:'Vicksburg' },
      scene:'vicksburg',
      // Viewpoint: the waterfront below the bluff. The set's first Mississippi and its first
      // river freight — a towboat pushing fifteen barges. The road ends at a floodwall gate,
      // which stands open onto the riverfront car park and the boat ramp.
      scenery:{ theme:'river', features:['tow','floodwall','trussbridge','levee'] },
      trainPreset:{ engine:'diesel' } },

    { id:'charleston', state:'South Carolina', city:'Charleston',
      say:{ en:'Charleston', pl:'Charleston' },
      scene:'charleston',
      // Viewpoint: down the Rainbow Row terrace to the harbour. The road crosses the
      // railroad and T's into East Battery at the sea wall; cars turn on and off the main
      // road along #turn-left-path / #turn-right-path / #battery-path, and vessels run the
      // channel on #harbour-path and #inshore-path.
      scenery:{ theme:'lowcountry-harbour', features:['rainbowrow','seawall','portcranes','steeples'] },
      trainPreset:{ engine:'diesel' } },

    { id:'glacier', state:'Montana', city:'Essex',
      say:{ en:'Glacier', pl:'Glacier' },
      scene:'glacier',
      // Viewpoint: the crossing at Essex on the Marias Pass main line, looking across it to
      // the Izaak Walton Inn, its red water tower and its caboose cabins, with the Middle
      // Fork and the layered peaks of the Flathead Range beyond. Autumn: the larch are gold.
      // The road ends in the inn's gravel yard — see #yard-left-path / #yard-right-path.
      scenery:{ theme:'northern-rockies', features:['larch','lodge','watertower','cabooses'] },
      trainPreset:{ engine:'diesel' } },
     { id:'newport', state:'Rhode Island', city:'Newport',
      say:{ en:'Newport', pl:'Newport' },
      scene:'newport',
      // Viewpoint: Thames Street opening onto the harbour, the Pell Bridge beyond. The set's
      // first sail. The road ends at a STATION rather than a junction — there are only 88
      // pixels between the horizon and the far gate, and a T-junction does not fit in that.
      scenery:{ theme:'harbour', features:['sails','pellbridge','station','thamesstreet'] },
      trainPreset:{ engine:'steam' } },

    { id:'mystic', state:'Connecticut', city:'Mystic',
      say:{ en:'Mystic', pl:'Mystic' },
      scene:'mystic',
      // Viewpoint: Main Street looking down onto the bascule bridge, head-on. The set's
      // first MOVABLE STRUCTURE — the span stands on end in front of you and a boat goes
      // through underneath. Two barriers on one road, meaning different things.
      scenery:{ theme:'seaport', features:['basculebridge','mainstreet','river','sloops'] },
      trainPreset:{ engine:'diesel' } },

    { id:'baileyyard', state:'Nebraska', city:'Bailey Yard',
      say:{ en:'Bailey Yard', pl:'Bailey Yard' },
      scene:'bailey-yard',
      // The first scene where the railroad IS the destination — everywhere else a railway
      // runs through somewhere, here the somewhere is the railway. The road crosses the
      // main line, passes the yard gate and runs between the two halves of the diesel shop.
      scenery:{ theme:'yard', features:['gantry','dieselshop','bowl','switchtower'] },
      trainPreset:{ engine:'diesel' } },

    { id:'neworleans', state:'Louisiana',  city:'New Orleans',   say:{ en:'New Orleans', pl:'Nowy Orlean' },   scene:'new-orleans', scenery:{ theme:'bayou',   features:['cathedral','galleries','riverboat','oaks'] }, trainPreset:{ engine:'streetcar' } },

    { id:'bentonville', state:'Arkansas', city:'Bentonville',
      say:{ en:'Bentonville', pl:'Bentonville' },
      scene:'bentonville',
      // Viewpoint: the street out of town, woodland down its left side and the brick square
      // down its right. The set's first scene about a sport, and the first with a SECOND
      // signalled crossing: the Razorback Greenway crosses the road on green paint at the
      // front of the frame, and its bike signal is meant to go green when the railway gate
      // is down and the cars are stopped. Timber wave on the near left, jump line on the
      // near right. Every bicycle in the scene is meant to move.
      scenery:{ theme:'ozark-trailtown', features:['timberwave','jumpline','greenway','square'] },
      trainPreset:{ engine:'diesel' } },

    { id:'birmingham', state:'Alabama', city:'Birmingham',
      say:{ en:'Birmingham', pl:'Birmingham' },
      scene:'birmingham',
      // Viewpoint: the road past Sloss Furnaces, cold and preserved — the stove row, the
      // comb of stacks, the skip hoist, the casting shed — with Vulcan on Red Mountain
      // behind and the city beyond. Kudzu everywhere. Drawn as the museum it is, not as a
      // working furnace: no pour, no heat in the sky.
      scenery:{ theme:'iron-city', features:['stoves','stacks','skiphoist','kudzu','vulcan'] },
      trainPreset:{ engine:'diesel' } },

    { id:'oklahomacity', state:'Oklahoma', city:'Oklahoma City',
      say:{ en:'Oklahoma City', pl:'Oklahoma City' },
      scene:'oklahoma-city',
      // Viewpoint: the oil field with the city behind it. The city is built on the Oklahoma
      // City Oil Field and its capitol grounds are the only ones in the US carrying working
      // rigs, so pumpjacks belong here as completely as in any pasture. Three of them, well
      // apart; the capitol and its lattice derrick small at the left; the skyline right.
      // The set's FIRST TRUE LINKAGE — see HANDOFF for the crank/beam/pitman contract.
      // A dust devil crosses the field. Deliberately not a tornado; see the scene docstring.
      scenery:{ theme:'oil-patch', features:['pumpjacks','tankbattery','dustdevil','capitol'] },
      trainPreset:{ engine:'diesel' } },

    { id:'wisconsindells', state:'Wisconsin', city:'Wisconsin Dells',
      say:{ en:'Wisconsin Dells', pl:'Wisconsin Dells' },
      scene:'wisconsin-dells',
      // Viewpoint: the water park on the left, the sandstone gorge on the right. The set
      // had no water play in it anywhere, which for this audience was a bigger hole than
      // any missing state. HEADLINE ANIMATION: a child rides the near flume and lands in
      // a splash (#slide-path, .cc-slider, .cc-splash). Also a duck boat driving down the
      // slipway into the Wisconsin River (#duck-path, .cc-duck, .cc-duck-tilt) and a
      // rider visible as a shadow inside the translucent tube (#tube-path).
      scenery:{ theme:'waterpark', features:['slidetower','flume','splash','gorge','duckboat','depot'] },
      trainPreset:{ engine:'diesel' } },

    { id:'dubuque', state:'Iowa', city:'Dubuque',
      say:{ en:'Dubuque', pl:'Dubuque' },
      scene:'dubuque',
      // Viewpoint: Lock and Dam No. 11 from the riverfront, with the wooded bluff and the
      // Fenelon Place Elevator on the left and the railroad swing bridge beyond.
      // HEADLINE ANIMATION: the lock cycle — #cc-lock-water's top edge moves between the
      // two pool levels, #cc-lockboat rides it, then #cc-lockgate's two leaves swing open
      // and the boat leaves. The set's first mechanism that is ABOUT WAITING.
      // Also: the swing bridge (#cc-swingspan/.cc-swing), the paddlewheel (.cc-paddle)
      // and the two funicular cars (#cc-funi-a/-b).
      scenery:{ theme:'river-lock', features:['lock','dam','swingbridge','funicular','bluff','sternwheeler'] },
      trainPreset:{ engine:'diesel' } },
  ];

  const STORAGE_KEY = 'cc.location';
  let currentId = localStorage.getItem(STORAGE_KEY) || LOCATIONS[0].id;

  // ---- the surprise bag ----------------------------------------------------
  // "Surprise me" draws WITHOUT REPLACEMENT: once a place has come up it is
  // skipped until every other one has, and only then does the bag refill. A
  // plain random pick would hand a child Chicago four times before it ever
  // showed them Denali, which is the opposite of encouraging them to explore.
  //
  // Choosing a place YOURSELF never touches the bag, deliberately. The bag is a
  // record of where CHANCE has taken you, not of where you have been, so going
  // back to a favourite on purpose does not use it up — and a child who loves
  // Chicago can visit it every day without ever being denied it by the dice.
  const DRAWN_KEY = 'cc.drawn';
  let drawn = [];
  try {
    const raw = JSON.parse(localStorage.getItem(DRAWN_KEY));
    // Filter against the current list: a location that has since been renamed or
    // removed would otherwise sit in the bag for ever and never empty it.
    if (Array.isArray(raw)) drawn = raw.filter(id => LOCATIONS.some(l => l.id === id));
  } catch (e) { drawn = []; }
  const saveDrawn = () => { try { localStorage.setItem(DRAWN_KEY, JSON.stringify(drawn)); } catch (e) {} };

  const world = {
    all() { return LOCATIONS.slice(); },
    byState() {
      const m = {};
      LOCATIONS.forEach(l => { (m[l.state] = m[l.state] || []).push(l); });
      return m;                       // used by the US-map picker
    },
    get current() { return LOCATIONS.find(l => l.id === currentId) || LOCATIONS[0]; },

    /** The place name in the active language, plus which voice should say it.
        Names that have no Polish form stay English (Rocky Mountains, Seattle,
        Austin), and an English name read by a Polish voice is not recognisable
        — so it is spoken by an English voice. See DESIGN.md §8.

        `say` is what is SHOWN; optional `sayAs` is what the voice is given when
        the two differ. Washington needs "Washington D C" to be read out as
        letters rather than slurred, but nobody should have to look at that on a
        button. Exactly the split i18n.welcome already makes with text/sayAs. */
    spoken(loc, code) {
      const lang = code || CC.i18n.code;
      const shown = (loc.say && loc.say[lang]) || loc.city || loc.state;
      const text = (loc.sayAs && loc.sayAs[lang]) || shown;
      const untranslated = loc.say && loc.say.en === shown && lang !== 'en';
      return { text: text, lang: untranslated ? 'en' : lang };
    },

    /** The state to announce alongside a place, or null when saying it would
        only repeat the place itself.

        ALWAYS ENGLISH, and always spoken by an English voice — state names are
        American proper nouns and decision #6 keeps them that way, the same rule
        the map labels follow. So this hands back the language too, exactly as
        `spoken()` does, and the caller does not have to remember. */
    spokenState(loc) {
      if (!loc || !loc.state || loc.stateIsPlace) return null;
      const shown = (loc.say && loc.say.en) || loc.city || '';
      if (shown === loc.state) return null;
      return { text: loc.state, lang: 'en' };
    },

    /** How far round the bag we are — { drawn, total }. */
    explored() { return { drawn: drawn.length, total: LOCATIONS.length }; },

    /** Draw the next surprise. Returns { loc, wrapped }; `wrapped` is true when
        the bag had to be refilled, which means everywhere has now come up once. */
    drawRandom() {
      let wrapped = false;
      let pool = LOCATIONS.filter(l => drawn.indexOf(l.id) < 0);
      if (!pool.length) { drawn = []; wrapped = true; pool = LOCATIONS.slice(); }
      // Never draw the place we are already standing in unless it is genuinely
      // the only one left — "surprise!" followed by going nowhere is not one.
      if (pool.length > 1) {
        const elsewhere = pool.filter(l => l.id !== currentId);
        if (elsewhere.length) pool = elsewhere;
      }
      const loc = pool[Math.floor(Math.random() * pool.length)];
      drawn.push(loc.id);
      saveDrawn();
      return { loc: loc, wrapped: wrapped };
    },

    select(id, opts) {
      const loc = LOCATIONS.find(l => l.id === id);
      if (!loc) return;
      currentId = id;
      localStorage.setItem(STORAGE_KEY, id);
      const s = this.spoken(loc);
      if (!opts || opts.speak !== false) {
        CC.speech && CC.speech.say(s.text, { interrupt: true, lang: s.lang });
      }
      CC.emit && CC.emit('location', loc);
    },
  };

  CC.world = world;
})(window.CC = window.CC || {});
