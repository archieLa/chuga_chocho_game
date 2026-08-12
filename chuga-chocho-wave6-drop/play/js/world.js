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
      // Viewpoint: the Upper Geyser Basin at Old Faithful, mid-morning. The ground is pale
      // sinter crust with bacterial mats — never grass.
      scenery:{ theme:'thermal', features:['geyser','bison','elk','oldfaithfulinn','hotsprings'] },
      trainPreset:{ engine:'steam' } },

    { id:'dc', state:'District of Columbia', city:'Washington',
      say:{ en:'Washington D C', pl:'Waszyngton' },
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
      say:{ en:'Kansas wheat country', pl:'kansaskie pola pszenicy' },
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
      say:{ en:'the Great Smoky Mountains', pl:'Wielkie Góry Dymne' },
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
      say:{ en:'the Kentucky bluegrass', pl:'kentuckijskie pastwiska' },
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
      // is a TREE — live oaks arch right across the top of the frame and the whole picture
      // is seen from underneath them, through hanging Spanish moss.
      scenery:{ theme:'lowcountry', features:['liveoaks','spanishmoss','rowhouses','square'] },
      trainPreset:{ engine:'streetcar' } },

    { id:'stonington', state:'Maine', city:'Stonington',
      say:{ en:'Stonington', pl:'Stonington' },
      scene:'stonington',
      // Viewpoint: the road down to the town landing on Deer Isle. Asymmetric — the village
      // climbs the granite on the left, the harbour opens right — and the road STOPS at the
      // landing. The first cold working coast in the set against three warm holiday ones.
      scenery:{ theme:'downeast', features:['lobsterboats','fishhouses','traps','granite'] },
      trainPreset:{ engine:'diesel' } },

    { id:'albuquerque', state:'New Mexico', city:'Albuquerque',
      say:{ en:'Albuquerque', pl:'Albuquerque' },
      scene:'albuquerque',
      // Viewpoint: the launch field at dawn during the balloon fiesta. The first scene in
      // the set where the SKY is the subject — ninety balloons above the skyline, the
      // Sandia wall behind, the cottonwood bosque along the Rio Grande.
      scenery:{ theme:'high-desert', features:['balloons','sandias','bosque','adobe'] },
      trainPreset:{ engine:'diesel' } },

    { id:'hatteras', state:'North Carolina', city:'Cape Hatteras',
      say:{ en:'Cape Hatteras', pl:'Przyl\u0105dek Hatteras' },
      scene:'cape-hatteras',
      // Viewpoint: the road behind the dune line. The set's first lighthouse, and a working
      // Atlantic rather than a holiday sea — the road stops at the car park by the dune
      // crossing and you walk over the boardwalk.
      scenery:{ theme:'barrier-island', features:['lighthouse','dunes','seaoats','pier'] },
      trainPreset:{ engine:'diesel' } },

    { id:'quechee', state:'Vermont', city:'Quechee',
      say:{ en:'Quechee', pl:'Quechee' },
      scene:'quechee',
      // Viewpoint: the road down to the covered bridge. The set's first autumn palette,
      // first waterfall and first mill — and the road runs INTO the bridge, which is the
      // most Vermont thing a road can do.
      scenery:{ theme:'new-england-fall', features:['fallhills','mill','dam','coveredbridge'] },
      trainPreset:{ engine:'steam' } },

    { id:'detroit', state:'Michigan', city:'Detroit',
      say:{ en:'Detroit', pl:'Detroit' },
      scene:'detroit',
      // Viewpoint: the plant gate. The set's first factory, and the only scene where the
      // railway is part of the subject: the auto-racks on the siding are loaded with the
      // cars the shed behind them just built.
      scenery:{ theme:'motor-city', features:['assemblyplant','shippinglot','autoracks','skyline'] },
      trainPreset:{ engine:'diesel' } },

    { id:'sunvalley', state:'Idaho', city:'Sun Valley',
      say:{ en:'Sun Valley', pl:'Sun Valley' },
      scene:'sun-valley',
      // Viewpoint: the valley road into Ketchum, with Bald Mountain behind it. The set's
      // FIRST WINTER scene — snow ground, blue snow shadows, bare aspens — and the first
      // aerial lift. The gondola cabins and the ploughs are both animatable; see HANDOFF.
      scenery:{ theme:'rockies-winter', features:['skimountain','gondola','chairlift','snowplough','groomer'] },
      trainPreset:{ engine:'diesel' } },

    { id:'indianapolis', state:'Indiana', city:'Indianapolis',
      say:{ en:'Indianapolis', pl:'Indianapolis' },
      scene:'indianapolis',
      // Viewpoint: the lawn outside the main straight, looking across the track. The set's
      // FIRST MOTORSPORT scene. Cars can be walked along #racing-line, and one can be sent
      // down #pit-in-path to #pit-box-stop for a wheel change; see HANDOFF.
      scenery:{ theme:'speedway', features:['oval','pagoda','pitlane','grandstands','racecars'] },
      trainPreset:{ engine:'diesel' } },

    { id:'neworleans', state:'Louisiana',  city:'New Orleans',   say:{ en:'New Orleans', pl:'Nowy Orlean' },   scene:'new-orleans', scenery:{ theme:'bayou',   features:['cathedral','galleries','riverboat','oaks'] }, trainPreset:{ engine:'streetcar' } },
  ];

  const STORAGE_KEY = 'cc.location';
  let currentId = localStorage.getItem(STORAGE_KEY) || LOCATIONS[0].id;

  const world = {
    all() { return LOCATIONS.slice(); },
    byState() {
      const m = {};
      LOCATIONS.forEach(l => { (m[l.state] = m[l.state] || []).push(l); });
      return m;                       // used by the US-map picker
    },
    get current() { return LOCATIONS.find(l => l.id === currentId) || LOCATIONS[0]; },

    select(id, opts) {
      const loc = LOCATIONS.find(l => l.id === id);
      if (!loc) return;
      currentId = id;
      localStorage.setItem(STORAGE_KEY, id);
      const name = (loc.say && loc.say[CC.i18n.code]) || loc.city || loc.state;
      if (!opts || opts.speak !== false) CC.speech && CC.speech.say(name, { interrupt: true });
      CC.emit && CC.emit('location', loc);
    },
  };

  CC.world = world;
})(window.CC = window.CC || {});
