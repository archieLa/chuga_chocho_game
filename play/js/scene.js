/* scene.js — puts a location on screen and keeps it alive.

   The art is already finished and committed; this file never draws scenery. It
   mounts the location's SVG, finds the layers the art promises are there, slips
   the moving things in between them, and drives one requestAnimationFrame loop.

   THE DEPTH CONTRACT (SCENE_GUIDE.md §2) — the scene's own layer order is:

       …  #road  #track  #gate-far  ▸▸ THE TRAIN GOES HERE ◂◂  #scenery-front  #gate-near  #foreground

   so the train passes BEHIND the near gate and IN FRONT OF the far one. We only
   ever insert into that order; we never re-order it.

   Road cars get the same treatment on both sides of the tracks: a car up the
   road is behind the train, a car near the bottom is in front of it, so they
   live in two groups and a car moves between them as it crosses.

   Everything shares one set of numbers, fixed for every scene by SCENE_GUIDE.md §1.
*/
(function (CC) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // ---- shared geometry — identical in all eight scenes -------------------
  const W = 1280, H = 720;
  const HORIZON = 300;
  const RAIL_Y = 500;              // a vehicle's own y=0 sits here
  const TRAIN_S = 0.55;            // vehicles are drawn a little smaller than life
  const GAP = 8;                   // coupling gap between vehicles, local units
  const TRAIN_SPEED = 270;         // px per second across the frame

  // The road is a perspective ribbon: 510,720 · 770,720 · 658,300 · 622,300.
  // Everything about a car — where its lane is, how big it is, how fast it
  // appears to move — falls out of its y.
  const ROAD_CX = 640, HALF_NEAR = 130, HALF_FAR = 18;
  const STOP_FAR = 396;            // a car coming down waits above the far gate (arm at y≈421)
  const STOP_NEAR = 566;           // a car coming up waits below the near gate (arm at y≈528)
  const CROSS_MID = 483;           // middle of the track band, y 450–516
  const CAR_FADE = 46;             // how far before the road's far end a car fades out
  // Lewes: the road ends inside a ship. `from` is where a car starts steering for
  // the opening, `aim` is the middle of the dark interior, `minS` how small it is
  // by the time the hold has it.
  const FERRY = { from: 410, aimX: 640, aimY: 364, minS: 0.3 };
  const BRIDGE_STOP = 386;         // where northbound traffic waits for a lifted span
  const CROSS_KEEP = [438, 530];   // no car may come to REST between these — the rails
  const CROSSING_X = [500, 780];   // where the road meets the rails

  const CAR_COLOURS = ['#e84a4a', '#3d7bd6', '#f4b400', '#7b3fb0', '#2aa84a', '#ff8c2a', '#e8e8ee'];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const roadHalf = (y) => HALF_FAR + (HALF_NEAR - HALF_FAR) * (clamp(y, HORIZON, H) - HORIZON) / (H - HORIZON);
  const depthScale = (y) => roadHalf(y) / HALF_NEAR;

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // =======================================================================
  // A car. Drawn here rather than authored as art because it is a game
  // object: it has to be recoloured, mirrored and scaled by the engine.
  // =======================================================================
  /** An open-wheel car seen from ABOVE, for a road that feeds a circuit. Same
      contract as buildCar — same length, nose toward `dir` — so the queueing,
      the stop lines and the depth scaling all work unchanged. Narrower body and
      four wheels standing off it: at road-car size the exposed wheels ARE the
      silhouette, and without them it just reads as a thin saloon. */
  function buildRaceCar(colour, dir) {
    const g = el('g', { class: 'cc-car' });
    const nose = dir > 0 ? 1 : -1;
    const dark = colour === '#e8e8ee' ? '#c9c9d4' : colour;
    g.appendChild(el('ellipse', { cx: 4, cy: 60, rx: 34, ry: 8, fill: '#000', opacity: 0.2 }));
    [[-40, -44], [26, -44], [-40, 14], [26, 14]].forEach(([x, y]) => {
      g.appendChild(el('rect', { x: x, y: y, width: 14, height: 32, rx: 5, fill: '#22262b' }));
    });
    g.appendChild(el('rect', { x: -30, y: 46 * nose - 5, width: 60, height: 11, rx: 3, fill: dark }));
    g.appendChild(el('rect', { x: -34, y: -58 * nose - 4, width: 68, height: 9, rx: 3, fill: colour }));
    g.appendChild(el('path', { fill: colour,
      d: nose > 0 ? 'M-10,-58 L10,-58 L16,-6 L-16,-6 Z' : 'M-10,58 L10,58 L16,6 L-16,6 Z' }));
    g.appendChild(el('rect', { x: -17, y: -30, width: 34, height: 62, rx: 12, fill: colour }));
    g.appendChild(el('rect', { x: -13, y: -10 * nose - 8, width: 26, height: 22, rx: 9, fill: '#2b3036' }));
    g.appendChild(el('circle', { cx: 0, cy: -14 * nose, r: 7, fill: '#e8e2d8' }));
    g.appendChild(el('rect', { x: -15, y: -3, width: 30, height: 5, rx: 2, fill: '#fff', opacity: 0.22 }));
    return g;
  }

  /** The SAME car seen from the side, for when it leaves the access road and
      joins the circuit. Two reasons it cannot just be the top-down sprite turned
      a quarter, the way Crater Lake's side road does it: the track is drawn in
      profile, so a plan view among side-on cars reads as a different game; and
      the pack is 101px long on screen where a road car is only 44, so it has to
      be drawn about 280 units long to arrive the right size.

      Origin is the WHEEL LINE, not the middle, so a car placed at the lane's y
      stands on the same ground as the pack. */
  function buildRaceCarSide(colour) {
    const g = el('g', { class: 'cc-car-side' });
    const dark = colour === '#e8e8ee' ? '#c9c9d4' : colour;
    g.appendChild(el('ellipse', { cx: 0, cy: -2, rx: 118, ry: 11, fill: '#000', opacity: 0.22 }));
    // floor and sidepods
    g.appendChild(el('path', { fill: colour,
      d: 'M-116,-22 L112,-22 L112,-38 L56,-42 L20,-64 L-32,-64 L-56,-42 L-116,-38 Z' }));
    g.appendChild(el('path', { fill: dark, opacity: 0.55, d: 'M-64,-42 L40,-42 L40,-60 L-24,-60 L-52,-46 Z' }));
    // airbox and halo
    g.appendChild(el('path', { fill: colour, d: 'M-32,-64 L12,-64 L4,-88 L-20,-88 Z' }));
    g.appendChild(el('ellipse', { cx: -36, cy: -64, rx: 18, ry: 10, fill: '#2b3036' }));
    g.appendChild(el('circle', { cx: -36, cy: -72, r: 10, fill: '#e8e2d8' }));
    g.appendChild(el('path', { d: 'M-60,-68 Q-36,-92 -12,-68', stroke: '#2b3036', 'stroke-width': 6, fill: 'none' }));
    // wings: front low at the right, rear tall at the left
    g.appendChild(el('rect', { x: 108, y: -30, width: 44, height: 10, rx: 4, fill: dark }));
    g.appendChild(el('rect', { x: -152, y: -96, width: 52, height: 12, rx: 4, fill: dark }));
    g.appendChild(el('rect', { x: -128, y: -94, width: 10, height: 62, fill: colour }));
    [[-84, 32], [80, 36]].forEach(([cx, r]) => {
      g.appendChild(el('circle', { cx: cx, cy: -r + 2, r: r, fill: '#22262b' }));
      g.appendChild(el('circle', { cx: cx, cy: -r + 2, r: r * 0.38, fill: '#4a5058' }));
    });
    return g;
  }

  function buildCar(colour, dir) {
    // Some roads carry something other than saloons. Indianapolis's is the
    // circuit access road, and the art says so with data-cars on the
    // carriageway; everything downstream of here is identical either way.
    if (currentScene && currentScene.carStyle === 'race') {
      // Both sprites live in the car from the start and one is shown at a time —
      // cheaper and far less fiddly than rebuilding the element mid-journey.
      const g = el('g', { class: 'cc-car' });
      const top = buildRaceCar(colour, dir);
      top.setAttribute('class', 'cc-car-top');
      g.appendChild(top);
      const side = buildRaceCarSide(colour);
      side.setAttribute('visibility', 'hidden');
      g.appendChild(side);
      return g;
    }
    // data-dir is for testing as much as anything: "no car may cross a closed
    // gate" is only checkable from outside if you can tell the two lanes apart.
    const g = el('g', { class: 'cc-car', 'data-dir': dir });
    const nose = dir > 0 ? 1 : -1;             // dir +1 drives toward the viewer
    const dark = colour === '#e8e8ee' ? '#c9c9d4' : colour;
    g.appendChild(el('ellipse', { cx: 5, cy: 62, rx: 40, ry: 9, fill: '#000', opacity: 0.2 }));
    [[-44, -40], [36, -40], [-44, 12], [36, 12]].forEach(([x, y]) => {
      g.appendChild(el('rect', { x: x, y: y, width: 9, height: 30, rx: 4, fill: '#23262b' }));
    });
    g.appendChild(el('rect', { x: -36, y: -62, width: 72, height: 124, rx: 22, fill: colour }));
    g.appendChild(el('rect', { x: -30, y: -30, width: 60, height: 58, rx: 16, fill: dark, opacity: 0.55 }));
    g.appendChild(el('rect', { x: -26, y: -42 * nose - 8, width: 52, height: 24, rx: 10, fill: '#cfeaf8' }));
    g.appendChild(el('rect', { x: -25, y: 22 * nose - 9, width: 50, height: 20, rx: 9, fill: '#a9d6ec' }));
    g.appendChild(el('rect', { x: -34, y: -3, width: 68, height: 6, rx: 3, fill: '#fff', opacity: 0.25 }));
    [-20, 20].forEach(x => {
      g.appendChild(el('circle', { cx: x, cy: 54 * nose, r: 7, fill: '#fff3c4' }));
      g.appendChild(el('circle', { cx: x, cy: -54 * nose, r: 6, fill: '#ff5a5a' }));
    });
    return g;
  }

  // =======================================================================
  // Mounting a location. Kept in a cache: going back to a place you have
  // already visited is instant, which matters when a child is hopping around
  // the map.
  // =======================================================================
  const mounted = {};              // location id -> mounted scene
  let stage = null;
  let currentScene = null;

  function directChildren(node, tag) {
    return Array.prototype.filter.call(node.children, c => c.tagName === tag);
  }

  function mount(loc) {
    if (mounted[loc.id]) return mounted[loc.id];
    const markup = CC.assets && CC.assets.scenes && CC.assets.scenes[loc.scene];
    if (!markup) { console.error('scene missing from asset-data.js:', loc.scene); return null; }

    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const svg = document.importNode(doc.documentElement, true);
    svg.setAttribute('class', 'cc-scene');
    svg.setAttribute('aria-hidden', 'true');

    const gateFar = svg.querySelector('#gate-far');
    const gateNear = svg.querySelector('#gate-near');
    const sceneryFront = svg.querySelector('#scenery-front');
    if (!gateFar || !gateNear || !sceneryFront) {
      console.error('scene is missing a required layer:', loc.scene);
      return null;
    }

    // Insert, never re-order. Far cars sit behind the far gate; the train and
    // its smoke sit between the far gate and the foreground; near cars sit in
    // front of the foreground but behind the near gate's arm.
    // ON THE CARRIAGEWAY, BEHIND THE RAILS. Scenery lives in scenery-back, which
    // is painted UNDER the road, so anything authored there that crosses the road
    // goes beneath the tarmac. Anything tagged data-over-road moves into a group
    // of its own between the road and the track: over the surface, still behind
    // the rails, the far gate and the train, which is how the engine's own far
    // cars are treated too.
    //
    // Its own group and NOT cc-cars-far, which looks like the same slot and is
    // not: leaving a scene empties the two car groups, so a scene's own art
    // parked in one would be destroyed the first time you walked away and never
    // come back, because scenes are cached and never rebuilt.
    //
    // I built this for Birmingham's tour party, then solved that another way and
    // deleted it as machinery with no foreseeable user. The foreseeable user was
    // four days later: Los Angeles has cyclists who cross the road on purpose,
    // and they rode along underneath it.
    // AFTER THE FAR GATE, not merely after the road. Between road and track was
    // the obvious slot and it is wrong: the far gate's arm comes down across
    // y=421 and the bike path is at 426, so the riders vanished under the arm at
    // exactly the moment the gate lets them cross. Anything on this side of the
    // road is NEARER than a gate whose base is at 388, so it goes in front of it —
    // and still behind the train, which is nearer than all of it.
    const overRoad = svg.querySelectorAll('[data-over-road]');
    if (overRoad.length) {
      const g = el('g', { class: 'cc-over-road' });
      gateFar.parentNode.insertBefore(g, gateFar.nextSibling);
      [].forEach.call(overRoad, e => g.appendChild(e));
    }

    const carsFar = el('g', { class: 'cc-cars-far' });
    const smokeG = el('g', { class: 'cc-smoke' });
    const trainG = el('g', { class: 'cc-train' });
    const carsNear = el('g', { class: 'cc-cars-near' });
    gateFar.parentNode.insertBefore(carsFar, gateFar);
    sceneryFront.parentNode.insertBefore(smokeG, sceneryFront);
    sceneryFront.parentNode.insertBefore(trainG, sceneryFront);
    gateNear.parentNode.insertBefore(carsNear, gateNear);

    // The gates belong to the scene — we only move what is already drawn.
    // Each post holds an arm group at translate(0,40) and two lamp circles.
    const arms = [], lamps = [];
    [gateFar, gateNear].forEach(gate => {
      directChildren(gate, 'g').forEach(post => {
        const arm = post.querySelector('g[transform*="translate(0,40)"]');
        if (arm) {
          const r = arm.querySelector('rect');
          const x = r ? parseFloat(r.getAttribute('x')) || 0 : 0;
          // The arm reaching to the right (+x) has to swing anticlockwise to rise.
          arms.push({ el: arm, sign: x < 0 ? 1 : -1 });
        }
        directChildren(post, 'circle').forEach((c, i) => lamps.push({ el: c, phase: i }));
      });
    });

    // Scenery trains — a train that is part of the ARTWORK rather than the one
    // the child drives (Colorado's Georgetown Loop, up on the trestle). The art
    // supplies its own rail, so the engine never learns a scene by name: tag a
    // group .cc-scenery-train and give it data-rail="x0,y0 cx,cy x1,y1".
    const sceneryTrains = [];
    svg.querySelectorAll('.cc-scenery-train').forEach(node => {
      const pts = (node.getAttribute('data-rail') || '').trim().split(/\s+/)
        .map(pair => pair.split(',').map(Number));
      if (pts.length !== 3 || pts.some(p => p.length !== 2 || p.some(isNaN))) {
        console.warn('scenery train has no usable data-rail:', loc.scene);
        return;
      }
      const run = (node.getAttribute('data-run') || '0 1').trim().split(/\s+/).map(Number);
      sceneryTrains.push({
        el: node,
        rail: pts,
        run: (run.length === 2 && !run.some(isNaN)) ? run : [0, 1],
        fade: parseFloat(node.getAttribute('data-fade')) || 0.1,
        lift: parseFloat(node.getAttribute('data-lift')) || 0,
        secs: parseFloat(node.getAttribute('data-secs')) || 12,
        pause: parseFloat(node.getAttribute('data-pause')) || 4,
        phase: 0,
      });
    });

    // WHERE THE ROAD ENDS. Most scenes run the carriageway to the horizon, but
    // some stop early: Crater Lake turns onto Rim Drive at y=368 and Horseshoe
    // Curve ends at the visitor car park at y=376. Cars must not drive off the
    // tarmac into a lake. Rather than a per-scene table, read it off the art —
    // the road polygon's own far edge IS the answer, so a scene that truncates
    // says so just by being drawn that way, and future ones need no code.
    let roadTop = HORIZON;
    let carStyle = null;
    const roadPoly = svg.querySelector('.cc-road');
    if (roadPoly) {
      const ys = (roadPoly.getAttribute('points') || '').trim().split(/\s+/)
        .map(p => parseFloat(p.split(',')[1])).filter(v => !isNaN(v));
      if (ys.length) roadTop = Math.max(HORIZON, Math.min.apply(null, ys));
      carStyle = roadPoly.getAttribute('data-cars') || null;
    }

    // Chicago's three moving parts. Same contract as everything else: the art
    // tags itself, the engine drives it, and a scene without the tags gets
    // nothing. The Ferris wheel turns with its pods hanging level, the L shuttles
    // along the viaduct, and the plane patrols above the lake and banks round.
    const ferris = [].map.call(svg.querySelectorAll('.cc-ferris'), node => ({
      el: node,
      secs: parseFloat(node.getAttribute('data-secs')) || 16,
      pods: [].map.call(node.querySelectorAll('.cc-pod'), q => ({
        el: q,
        px: parseFloat(q.getAttribute('data-px')) || 0,
        py: parseFloat(q.getAttribute('data-py')) || 0,
      })),
      a: 0,
    }));

    const shuttles = [];
    [['.cc-el-train', 'data-run', 96], ['.cc-plane', 'data-fly', 58],
     ['.cc-ship', 'data-sail', 40]].forEach(([sel, attr, speed]) => {
      [].forEach.call(svg.querySelectorAll(sel), node => {
        const v = (node.getAttribute(attr) || '').split(',').map(Number);
        if (v.length !== 3 || v.some(isNaN)) return;
        // data-fly / data-run is "from,to,y" — it STARTS at the first and heads
        // for the second, so the art can say which side it enters from.
        const lo = Math.min(v[0], v[1]), hi = Math.max(v[0], v[1]);
        shuttles.push({ el: node, x0: lo, x1: hi, y: v[2],
                        x: v[0], dir: v[1] > v[0] ? 1 : -1,
                        // The per-selector figure is the default; a single vehicle
                        // can say otherwise. A sailboat and a ferry sharing a bay
                        // at the same speed read as one mechanism, not two boats.
                        speed: parseFloat(node.getAttribute('data-speed')) || speed,
                        // Which way the ARTWORK points. +1 nose-right (the L),
                        // -1 nose-left (the plane). Mirror only when the two
                        // disagree, or it flies backwards.
                        nose: parseFloat(node.getAttribute('data-nose')) || 1,
                        // The engine rewrites the whole transform each frame, so any
                        // scale baked into the art would be thrown away. Art that is
                        // drawn at another size says so with data-scale.
                        s: parseFloat(node.getAttribute('data-scale')) || 1,
                        bank: sel === '.cc-plane', turn: 0 });
      });
    });

    // The launch. Cape Canaveral draws a rocket mid-climb with a flame and a
    // rolling ground cloud; the engine sets her back on the pad and flies her.
    let rocket = null;
    const rocketG = svg.querySelector('.cc-rocket');
    if (rocketG) {
      const puffs = svg.querySelector('.cc-rocket-puffs');
      const pad = ((puffs && puffs.getAttribute('data-pad')) || '').split(',').map(Number);
      rocket = {
        el: rocketG,
        flame: rocketG.querySelector('.cc-flame'),
        cloud: svg.querySelector('.cc-rocket-smoke'),
        glow: svg.querySelector('.cc-rocket-glow'),
        puffG: puffs,
        padX: pad.length === 2 && !isNaN(pad[0]) ? pad[0] : 886,
        padY: pad.length === 2 && !isNaN(pad[1]) ? pad[1] : 282,
        padDy: parseFloat(rocketG.getAttribute('data-pad-dy')) || 0,
        t: 0, phase: 'wait', dy: 0, vel: 0, puffs: [],
      };
    }

    // Chairlifts. Gatlinburg's SkyLift climbs the hillside on two cables, and a
    // child watching it expects the chairs to move. Same shape of contract as
    // everything else here: the art tags itself and the engine drives it.
    const cablecars = [];
    svg.querySelectorAll('.cc-cablecar').forEach(node => {
      const m = (node.getAttribute('data-cable') || '').trim().split(/\s+/)
        .map(pair => pair.split(',').map(Number));
      if (m.length !== 2 || m.some(p => p.length !== 2 || p.some(isNaN))) return;
      const chairs = [].map.call(node.querySelectorAll('.cc-chair'), c => ({
        el: c,
        t: parseFloat(c.getAttribute('data-t')) || 0,
        lane: parseInt(c.getAttribute('data-lane'), 10) || 0,
      }));
      if (chairs.length) {
        cablecars.push({ a: m[0], b: m[1], chairs: chairs,
                         dy: parseFloat(node.getAttribute('data-lane-dy')) || 0 });
      }
    });

    // WHERE THE ROAD GOES NEXT. Crater Lake's carriageway does not just stop —
    // it meets Rim Drive and turns. Without this, cars reaching the end simply
    // faded out in the middle of the picture, which looked like a bug because it
    // was one. data-exit is "nearEdgeY,farEdgeY,junctionX" and the engine drives
    // the turn from it: traffic going away swings right and runs off east, and
    // traffic coming toward us arrives along Rim Drive and turns down onto the
    // carriageway. A scene without .cc-road-exit keeps the old fade.
    let roadExit = null;
    const exitEl = svg.querySelector('.cc-road-exit');
    if (exitEl) {
      const raw = (exitEl.getAttribute('data-exit') || '').split(',');
      // An optional 4th token, "east", says both streams run the SAME way along
      // the side road: traffic off the carriageway turns right and heads east,
      // and traffic joining comes in from the far west, drives east along the
      // street and turns right down onto the carriageway. One lane serves both,
      // so they queue behind each other instead of passing — which is the only
      // way a street this narrow can carry two directions at all.
      const sameDir = raw[3] === 'east';
      const v = raw.slice(0, 3).map(Number);
      if (v.length === 3 && !v.some(isNaN)) {
        roadExit = {
          y0: v[0], y1: v[1], jx: v[2],
          // Pushed to the outer thirds so the two streams clear each other: a car
          // is ~24px tall here and the band is 56px, so 0.75/0.25 leaves a full
          // car's height between them.
          sameDir: sameDir,
          // One lane down the middle when both streams share it; otherwise the
          // outer thirds, so the two can pass.
          laneOut: sameDir ? (v[0] + v[1]) / 2 : v[0] + (v[1] - v[0]) * 0.75,
          laneIn: sameDir ? (v[0] + v[1]) / 2 : v[0] + (v[1] - v[0]) * 0.25,
          toX: 1340, fromX: -90,
        };
        // TWO LANES ONLY IF TWO LANES FIT. A car on the side road is turned a
        // quarter, so what has to clear is its WIDTH — 72 at full size — against
        // the gap between the lanes. Rim Drive is a 56px band and clears it
        // easily; Ketchum's cross street is barely 30 and does not, so the two
        // streams drove through each other. Where they will not fit, the street
        // runs one way and nothing arrives along it.
        // The engine used to MEASURE whether two lanes fit and quietly drop to
        // one where they did not. It was a stopgap for Ketchum, which now says
        // "east" outright — and it silently broke Rim Drive the moment the car
        // width was corrected from 72 to 89, taking its inbound traffic away
        // with no error anywhere. The art decides; the engine does not guess.
      }
    }

    // An ambient train on a curved line drawn into the scene — Horseshoe Curve
    // exports #curve-path, the centreline of the near running road. This is
    // scenery, NOT the gameplay train: it loops for ever and the gate has no
    // opinion about it, because it never touches the crossing.
    const curve = buildCurveTrain(svg);

    // Mount Washington's cog train and Cedar Point's coaster cars. Same rule as
    // everything else in here: the art tags itself, a scene without the tags
    // quietly gets nothing, and neither one knows the gate exists.
    const cog = buildCogTrain(svg);
    const coasters = buildCoasters(svg);
    const spinners = buildSpinners(svg);
    const swarms = buildSwarms(svg);
    const chases = buildChases(svg);
    const routes = buildRoutes(svg);
    const balloons = buildBalloons(svg);
    const boom = buildBoom(svg);
    const gantry = buildGantry(svg);
    const bascule = buildBascule(svg);
    const channel = buildChannel(svg);
    const idles = buildIdles(svg);
    const drifts = buildDrifts(svg);
    const flags = buildFlags(svg);
    const kites = buildKites(svg);
    const lock = buildLock(svg);
    const berth = buildBerth(svg);
    const waves = buildWaves(svg);
    const swing = buildSwing(svg);
    const funi = buildFunis(svg);
    const cyclists = buildCyclists(svg);
    const jets = buildJets(svg);
    const watchers = buildWatchers(svg);
    const pumpjacks = buildPumpjacks(svg);
    const devil = buildDustDevil(svg);
    const busStop = buildBusStop(svg);
    const slide = buildSlide(svg);
    const tube = buildTube(svg);
    const duck = buildDuck(svg);
    const geysers = buildGeysers(svg);
    const aurora = buildAurora(svg);
    const canters = buildCanters(svg);
    const crawls = buildCrawls(svg);
    const halt = buildHalt(svg);
    const race = buildRace(svg);
    const lifts = buildLifts(svg);
    const skiers = buildSkiers(svg);
    const ploughs = buildPloughs(svg);
    const crane = buildCrane(svg, trainG);
    const falls = buildFalls(svg);
    const bikeSig = buildBikeSignals(svg);
    const rides = buildRides(svg);
    const vultures = buildVultures(svg);
    const vessels = buildVessels(svg);
    const tour = buildTour(svg);

    const s = { id: loc.id, svg: svg, arms: arms, lamps: lamps, sceneryTrains: sceneryTrains,
                roadTop: roadTop, carStyle: carStyle, roadExit: roadExit, curve: curve, cablecars: cablecars, rocket: rocket,
                ferris: ferris, shuttles: shuttles, cog: cog, coasters: coasters,
                spinners: spinners, swarms: swarms, chases: chases, routes: routes, balloons: balloons, falls: falls, boom: boom, gantry: gantry, bascule: bascule, channel: channel, idles: idles, drifts: drifts, flags: flags, jets: jets, kites: kites, lock: lock, berth: berth, waves: waves, swing: swing, funi: funi, cyclists: cyclists, watchers: watchers, pumpjacks: pumpjacks, devil: devil, busStop: busStop, slide: slide, tube: tube, duck: duck, geysers: geysers, aurora: aurora, canters: canters, crawls: crawls, halt: halt, haltTurn: false, race: race, lifts: lifts, skiers: skiers, ploughs: ploughs, crane: crane, racks: null, shuntTurn: false, vessels: vessels, tour: tour,
                bikeSig: bikeSig, rides: rides, vultures: vultures,
                trainG: trainG, smokeG: smokeG, carsFar: carsFar, carsNear: carsNear };
    mounted[loc.id] = s;
    stage.appendChild(svg);
    s.racks = buildRacks(svg);       // after attaching: it measures with getBBox
    linkGantry(s.gantry, s.racks);   // and the yard crane lifts what buildRacks made
    return s;
  }

  // =======================================================================
  // Ambient train on a drawn curve (Horseshoe Curve).
  //
  // The gameplay train runs the straight track band between the two gates, and
  // the crossing, the gates and the endpoint logic are all built on that. A
  // train following the bowl has no crossing to close a gate against, so this is
  // deliberately separate: pure background motion, always running, gate-blind.
  // A scene opts in simply by exporting <path id="curve-path">; every other
  // scene has none and quietly gets no background train.
  // =======================================================================
  // A long freight — the whole reason Horseshoe Curve is famous is that a train
  // long enough can see its own tail round the bowl. The path is ~1517 units and
  // a hopper eats ~53 of them at mean depth, so 24 wagons wrap about nine tenths
  // of the loop and leave just enough gap to tell the head from the tail.
  const CURVE_HOPPERS = ['#6b6f76', '#7c5a3a', '#5d6670', '#8a5a34'];
  const CURVE = {
    consist: [{ type: 'diesel', colours: { loco: '#2f4c72', trim: '#c8a23a' } }].concat(
      Array.from({ length: 24 }, (_, i) => ({
        type: 'wagon-hopper', colours: { wagon: CURVE_HOPPERS[i % CURVE_HOPPERS.length] },
      }))),
    speed: 46,            // path units per second — a slow freight, far away
    base: 0.36,           // multiplies the art's own depth rule (see curveDepth)
    gap: 6,
  };
  // The depth rule the Horseshoe art uses for everything in the bowl, given by
  // the handoff: 1.0 at the near arms, tiny at the apex. Multiplied by `base` so
  // the background train sits just behind the gameplay train's 0.55 at the
  // crossing rather than towering over it.
  const curveDepth = (y) => CURVE.base * (0.36 + 1.02 * (y - 306) / 146);

  function buildCurveTrain(svg) {
    const path = svg.querySelector('#curve-path');
    if (!path || !path.getTotalLength) return null;
    let total = 0;
    try { total = path.getTotalLength(); } catch (e) { return null; }
    if (!total) return null;

    const holder = el('g', { class: 'cc-curve-train' });
    // Deepest of everything the engine adds: this is distant scenery, so it goes
    // behind the far gate along with the far cars.
    const gateFar = svg.querySelector('#gate-far');
    gateFar.parentNode.insertBefore(holder, gateFar);

    // Each car carries its OWN length, because spacing has to be computed per
    // vehicle at its own depth — see updateCurveTrain.
    const cars = CURVE.consist.map(v => {
      const m = CC.rolling.meta(v.type) || { length: 250, originFromRear: 125 };
      const g = CC.rolling.build(v.type, v.colours);
      holder.appendChild(g);
      return { el: g, type: v.type, len: m.length, originFromRear: m.originFromRear };
    });
    // The train's own length ALREADY IN PATH UNITS: local length x base x the
    // mean of the depth rule over the path (~0.62). Whoever touches this next:
    // it is not in local units, so do not scale it again downstream.
    const span = cars.reduce((t, c) => t + (c.len + CURVE.gap) * CURVE.base * 0.62, 0);
    // The USABLE stretch, not the whole path. Its last 240 units dive steeply
    // off the bottom-right — heading swings from 10 to 54 degrees and the depth
    // scale nearly doubles — so a vehicle out there tips nose-down and looms,
    // which read as the train lifting off the rail before it vanished. All of
    // that is past the right edge of the frame anyway, so it is simply not used:
    // the train is hidden and wrapped at the point the path leaves the picture.
    // It also stops the tail taking half a minute to clear.
    let exitAt = total;
    for (let d = 0; d <= total; d += 4) {
      if (path.getPointAtLength(d).x > 1250) { exitAt = d; break; }
    }
    return { path: path, total: total, exitAt: exitAt, cars: cars, dist: 0, span: span };
  }

  // =======================================================================
  // The Cog Railway (Mount Washington).
  //
  // The art exports <path id="cog-path"> — base at length 0, summit at the end —
  // and two drawn trains, #cog-train-a and #cog-train-b. We clone one of those
  // rather than building rolling stock, because the drawn one is RIGHT in ways
  // that are easy to get wrong and hard to spot: the boiler is tilted back so it
  // sits level on the grade while the coach stays upright, and the engine is
  // downslope of the coach because a cog engine PUSHES. Cloning keeps all of it.
  //
  // Both originals are then hidden. It is a single track, and the real railway
  // genuinely does send one train up and bring it back down the same rail — so
  // exactly one train may be on it, or the scene is telling a child a lie about
  // how the mountain works.
  //
  // Ids are namespaced per scene by inline-assets.py, but the namespace is a
  // PREFIX (s-mt-washington-cog-path), so a suffix match finds them without
  // needing a KEEP_IDS entry — and because we only ever search inside this
  // scene's own root, there is nothing to collide with.
  // =======================================================================
  const COG = {
    up: 15,            // seconds base to summit
    down: 12.5,        // and back down
    holdTop: 2.5,      // a breather at the top …
    holdBottom: 3.5,   // … and longer at Marshfield, where it loads
    // The art's own depth rule, given by the handoff: full size at the base,
    // 0.38 at the summit. An animated train has to use it or it will not match
    // the mountain it is climbing.
    depth: (t) => 1 - 0.62 * t,
  };

  function buildCogTrain(svg) {
    const path = svg.querySelector('[id$="cog-path"]');
    if (!path || !path.getTotalLength) return null;
    let total = 0;
    try { total = path.getTotalLength(); } catch (e) { return null; }
    if (!total) return null;

    const drawn = svg.querySelector('[id$="cog-train-a"]');
    const other = svg.querySelector('[id$="cog-train-b"]');
    if (!drawn) return null;

    const train = drawn.cloneNode(true);
    train.removeAttribute('id');
    train.setAttribute('class', 'cc-cog-train');
    drawn.parentNode.insertBefore(train, drawn);
    drawn.setAttribute('display', 'none');
    if (other) other.setAttribute('display', 'none');

    // The line is ruled dead straight, so the heading is a constant and we can
    // take it once from the two ends instead of sampling every frame.
    const a = path.getPointAtLength(0), b = path.getPointAtLength(total);
    let deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    // KEEP IT THE RIGHT WAY UP. This line climbs up and to the LEFT, so its
    // heading is about -125 degrees, and rotating an upright vehicle by that
    // swings it past vertical — it ends up hanging under the rail with its roof
    // pointing downhill, which is exactly what it looked like. Turn to the
    // DOWNHILL angle instead and mirror: same direction of travel, right way up.
    // The rule is general, so a line climbing to the right needs no special case.
    let flip = 1;
    if (Math.abs(deg) > 90) { deg += 180; flip = -1; }
    return { path: path, total: total, el: train, deg: deg, flip: flip,
             t: 0, dir: 1, wait: COG.holdBottom };
  }

  function updateCogTrain(dt) {
    const c = currentScene && currentScene.cog;
    if (!c) return;
    if (c.wait > 0) { c.wait -= dt / 1000; if (c.wait > 0) return; }
    c.t += (c.dir * (dt / 1000)) / (c.dir > 0 ? COG.up : COG.down);
    if (c.t >= 1) { c.t = 1; c.dir = -1; c.wait = COG.holdTop; }
    else if (c.t <= 0) { c.t = 0; c.dir = 1; c.wait = COG.holdBottom; }
    const p = c.path.getPointAtLength(c.t * c.total);
    // No mirroring when it reverses: the engine stays downslope going both ways,
    // which is exactly what a pushing cog engine does.
    const s = COG.depth(c.t);
    // The train does NOT run round at the summit, and must not be made to. The
    // engine stays below the coach in both directions — pushing up, braking
    // down — and on this railway the coach is not even coupled to it, just
    // resting against it with its own brakes. Nothing uphill of the engine
    // depends on a coupling that could fail. That is the whole safety story of
    // the line, so `flip` is constant and the mirror never changes with `dir`.
    c.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
      ') rotate(' + c.deg.toFixed(1) + ') scale(' + (c.flip * s).toFixed(3) + ',' + s.toFixed(3) + ')');
  }

  // =======================================================================
  // Roller coasters (Cedar Point). <path id="coaster-path-blue"> and "-red"
  // run from the foot of the lift hill to the last valley.
  //
  // No depth scaling here — the rides are all at about the same distance, so a
  // car is a constant size. Rotation matters far more than it does on the cog
  // line: sample two nearby points, or the car climbs a vertical lift lying flat
  // on its back.
  //
  // Speed is not a constant and must not be. A coaster is winched slowly up the
  // lift and then runs on gravity, and that contrast IS what a coaster looks
  // like from across a park. So: constant crawl to the crest, and after it a
  // speed that grows with how far the car has fallen below that crest. Both come
  // out of the path's own geometry, so neither scene nor ride is hard-coded.
  // =======================================================================
  const COASTER = {
    lift: 70,          // units/s up the lift hill — winched, so steady and slow
    minSpeed: 90,      // crawling over a crest
    gain: 1.25,        // units/s gained per unit fallen below the crest
    maxSpeed: 360,     // the bottom of the first drop
    station: 1.8,      // seconds in the station before the next run
    cars: 3,           // a coaster TRAIN — one car alone reads as a bird
    spacing: 17,       // path units between car centres
  };

  function buildCoasterCar(body) {
    const g = el('g', { class: 'cc-coaster-car' });
    g.appendChild(el('rect', { x: -9, y: -4, width: 18, height: 4, rx: 1.6, fill: '#2f3440' }));
    g.appendChild(el('rect', { x: -8, y: -13, width: 16, height: 9, rx: 3.2, fill: body }));
    // Two riders with their arms up, because that is the whole point of a coaster.
    [-3.4, 3.2].forEach(x => {
      g.appendChild(el('circle', { cx: x, cy: -15.4, r: 2.4, fill: '#f0c49a' }));
      g.appendChild(el('path', {
        d: 'M' + (x - 2) + ',-16.2 l-1.8,-3.4 M' + (x + 2) + ',-16.2 l1.8,-3.4',
        stroke: '#f0c49a', 'stroke-width': 1.4, 'stroke-linecap': 'round', fill: 'none' }));
    });
    return g;
  }

  function buildCoasters(svg) {
    const out = [];
    const paths = svg.querySelectorAll('[id$="coaster-path-blue"], [id$="coaster-path-red"]');
    paths.forEach((path, i) => {
      if (!path.getTotalLength) return;
      let total = 0;
      try { total = path.getTotalLength(); } catch (e) { return; }
      if (!total) return;

      // Walk the path once to find the crest — the highest point, which is the
      // top of the lift hill on both of these. Everything after it is gravity.
      let liftEnd = 0, yTop = Infinity;
      for (let d = 0; d <= total; d += 4) {
        const y = path.getPointAtLength(d).y;
        if (y < yTop) { yTop = y; liftEnd = d; }
      }

      // A train, not a single car. Each car is placed on the path from its OWN
      // length, rather than drawn as one rigid group at an offset — a rigid
      // three-car train is 34 units long and these hills are barely 100 across,
      // so it would visibly lift off the rail at every crest.
      const cars = [];
      for (let k = 0; k < COASTER.cars; k++) {
        const car = buildCoasterCar(i === 0 ? '#f7c331' : '#ff6b35');
        path.parentNode.appendChild(car);
        cars.push(car);
      }
      // Stagger them, or the two rides pulse in lockstep and read as one machine.
      out.push({ path: path, total: total, cars: cars, liftEnd: liftEnd, yTop: yTop,
                 d: i === 0 ? 0 : total * 0.45, wait: i === 0 ? 0 : 0.9 });
    });
    return out;
  }

  function updateCoasters(dt) {
    const list = currentScene && currentScene.coasters;
    if (!list || !list.length) return;
    const secs = dt / 1000;
    const tail = (COASTER.cars - 1) * COASTER.spacing;
    list.forEach(c => {
      if (c.wait > 0) {
        c.wait -= secs;
        c.cars.forEach(car => car.setAttribute('display', 'none'));
        return;
      }
      // Speed is taken at the FRONT car: the whole train is on the lift until the
      // leader crests, and then the whole train accelerates, which is what a
      // chain lift and a drop actually do to one.
      const head = c.path.getPointAtLength(clamp(c.d, 0, c.total));
      const speed = c.d < c.liftEnd
        ? COASTER.lift
        : clamp(COASTER.minSpeed + COASTER.gain * (head.y - c.yTop), COASTER.minSpeed, COASTER.maxSpeed);
      c.d += speed * secs;
      if (c.d > c.total + tail) {   // the last car has cleared the final valley
        c.d = 0; c.wait = COASTER.station;
        c.cars.forEach(car => car.setAttribute('display', 'none'));
        return;
      }
      c.cars.forEach((car, k) => {
        const at = c.d - k * COASTER.spacing;
        if (at < 0 || at > c.total) { car.setAttribute('display', 'none'); return; }
        car.removeAttribute('display');
        const p = c.path.getPointAtLength(at);
        // Heading from two nearby samples — on a lift hill this is near vertical.
        const a = c.path.getPointAtLength(Math.max(0, at - 3));
        const b = c.path.getPointAtLength(Math.min(c.total, at + 3));
        const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        car.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
          ') rotate(' + deg.toFixed(1) + ')');
      });
    });
  }

  // =======================================================================
  // Three small contracts that cost almost nothing per frame.
  //
  //   .cc-spin   a wheel turning about its own hub  (the New Orleans paddlewheel)
  //   .cc-swarm  a cloud that boils                 (the Austin bats)
  //   .cc-chase  bulbs lighting in sequence         (the Las Vegas neon)
  //
  // All three are gate-blind like everything else in this file, and a scene
  // without the class quietly gets nothing.
  // =======================================================================

  // A wheel. Unlike .cc-ferris this does NOT keep anything level — it is the
  // whole point that it turns. The hub is in the vehicle's own local
  // coordinates, so it keeps working when its parent is moved or mirrored.
  function buildSpinners(svg) {
    const out = [];
    svg.querySelectorAll('.cc-spin').forEach(node => {
      const secs = parseFloat(node.getAttribute('data-secs')) || 3;
      out.push({ el: node, secs: secs,
                 cx: parseFloat(node.getAttribute('data-cx')) || 0,
                 cy: parseFloat(node.getAttribute('data-cy')) || 0, a: 0 });
    });
    return out;
  }

  function updateSpinners(dt) {
    const list = currentScene && currentScene.spinners;
    if (!list || !list.length) return;
    list.forEach(s => {
      s.a = (s.a + 360 * (dt / 1000) / s.secs) % 360;
      s.el.setAttribute('transform', 'rotate(' + s.a.toFixed(1) + ' ' + s.cx + ' ' + s.cy + ')');
    });
  }

  // A swarm. The art draws thousands of individuals split across a handful of
  // groups, with neighbours landing in DIFFERENT groups; drifting the groups
  // against each other therefore moves every individual relative to the ones
  // beside it. Animating the individuals would be thousands of writes a frame
  // for an effect nobody could tell apart from this one.
  const SWARM = {
    ax: 7, ay: 4,                            // drift amplitude, px
    periods: [3.1, 3.9, 4.7, 5.5],           // seconds — deliberately not multiples
    fade: 0.13,                              // how much the opacity breathes
  };

  function buildSwarms(svg) {
    const out = [];
    svg.querySelectorAll('.cc-swarm').forEach(node => {
      directChildren(node, 'g').forEach((band, i) => {
        const base = parseFloat(band.getAttribute('opacity'));
        out.push({ el: band, i: i, base: isNaN(base) ? 1 : base,
                   p: SWARM.periods[i % SWARM.periods.length],
                   q: SWARM.periods[(i + 2) % SWARM.periods.length] });
      });
    });
    return out;
  }

  function updateSwarms(t) {
    const list = currentScene && currentScene.swarms;
    if (!list || !list.length) return;
    const s = t / 1000;
    list.forEach(b => {
      const ph = b.i * 1.7;
      const dx = SWARM.ax * Math.sin(2 * Math.PI * s / b.p + ph);
      const dy = SWARM.ay * Math.sin(2 * Math.PI * s / b.q + ph * 1.6);
      b.el.setAttribute('transform', 'translate(' + dx.toFixed(2) + ',' + dy.toFixed(2) + ')');
      b.el.setAttribute('opacity',
        (b.base * (1 - SWARM.fade + SWARM.fade * Math.sin(2 * Math.PI * s / b.q + ph))).toFixed(3));
    });
  }

  // Chasing bulbs. Every third bulb is lit and the pattern walks along the
  // border, which is what a real marquee does — a whole sign blinking on and
  // off is a different, much cheaper-looking thing.
  const CHASE_ON = 1, CHASE_OFF = 0.22;

  function buildChases(svg) {
    const out = [];
    svg.querySelectorAll('.cc-chase').forEach(node => {
      const bulbs = Array.prototype.slice.call(node.children);
      if (!bulbs.length) return;
      out.push({ bulbs: bulbs, rate: parseFloat(node.getAttribute('data-rate')) || 7, step: -1 });
    });
    return out;
  }

  function updateChases(t) {
    const list = currentScene && currentScene.chases;
    if (!list || !list.length) return;
    list.forEach(c => {
      const step = Math.floor(t / 1000 * c.rate);
      if (step === c.step) return;          // only touch the DOM when it changes
      c.step = step;
      for (let i = 0; i < c.bulbs.length; i++) {
        c.bulbs[i].setAttribute('opacity', (i + step) % 3 === 0 ? CHASE_ON : CHASE_OFF);
      }
    });
  }

  // =======================================================================
  // A waypoint route (.cc-route) — for a thing that works, pauses, and turns
  // back somewhere specific, rather than bouncing between two x like a shuttle.
  //
  // The Kansas tractor is why this exists. As a shuttle it ran the full width of
  // the frame at a constant speed, which drove it straight through the level
  // crossing and under the road surface. A tractor does not do that; it works
  // one field, turns at the verge, and comes back.
  //
  //   data-route   stops in order, looping. Each is "x", "x:dwell" (seconds held
  //                there) or "@x" (jump there instantly — only ever used
  //                off-screen, where the jump cannot be seen, so the thing can
  //                leave one side and reappear on the other without crossing
  //                what is in between).
  //   data-y  data-scale  data-speed  data-nose   as for a shuttle.
  // =======================================================================
  function buildRoutes(svg) {
    const out = [];
    svg.querySelectorAll('.cc-route').forEach(node => {
      const stops = (node.getAttribute('data-route') || '').trim().split(/\s+/)
        .filter(Boolean).map(tok => {
          const jump = tok.charAt(0) === '@';
          const parts = (jump ? tok.slice(1) : tok).split(':');
          return { x: parseFloat(parts[0]), dwell: parseFloat(parts[1]) || 0, jump: jump };
        }).filter(s => !isNaN(s.x));
      if (stops.length < 2) { console.warn('cc-route has no usable data-route'); return; }
      out.push({
        el: node, stops: stops, i: 0, wait: 0, dir: 1,
        x: stops[stops.length - 1].x,      // start where the loop ends, so stop 0 is the first drive
        y: parseFloat(node.getAttribute('data-y')) || 0,
        s: parseFloat(node.getAttribute('data-scale')) || 1,
        nose: parseFloat(node.getAttribute('data-nose')) || 1,
        speed: parseFloat(node.getAttribute('data-speed')) || 30,
      });
    });
    return out;
  }

  function updateRoutes(dt) {
    const list = currentScene && currentScene.routes;
    if (!list || !list.length) return;
    const secs = dt / 1000;
    list.forEach(r => {
      if (r.wait > 0) {
        r.wait -= secs;
      } else {
        const stop = r.stops[r.i];
        if (stop.jump) {
          r.x = stop.x;                          // off-screen: nobody sees the jump
          r.i = (r.i + 1) % r.stops.length;
        } else {
          const d = stop.x - r.x;
          if (Math.abs(d) <= r.speed * secs) {   // arrived
            r.x = stop.x;
            r.wait = stop.dwell;
            r.i = (r.i + 1) % r.stops.length;
          } else {
            r.dir = d > 0 ? 1 : -1;
            r.x += r.speed * r.dir * secs;
          }
        }
      }
      const sx = (r.dir !== r.nose ? -r.s : r.s);
      r.el.setAttribute('transform', 'translate(' + r.x.toFixed(1) + ',' + r.y +
        ') scale(' + sx + ',' + r.s + ')');
    });
  }

  // =======================================================================
  // The Albuquerque mass ascension (.cc-balloon).
  //
  // A balloon only ever does two things: it drifts and it bobs. The art hands
  // over everything needed — data-x/data-y where it starts, data-s which is
  // both its scale and its depth, and data-maxy, the lowest its basket may go
  // before it would be buried in the Sandia ridge.
  //
  // Two rules make nineteen balloons read as a sky rather than as a sheet of
  // wallpaper sliding past:
  //
  //   PARALLAX — drift amplitude scales with data-s, so the near ones swing and
  //   the far ones barely stir. Uniform motion flattens the whole thing.
  //
  //   RESTRAINT — real balloons at altitude hardly appear to move at all, and
  //   that is exactly what sells the scale. Periods are tens of seconds, and
  //   every balloon has its own so the field never falls into step.
  //
  // The drift is an OSCILLATION, not a wrap. data-maxy is computed for ±90px
  // either side of each balloon's OWN x, so carrying one across the frame would
  // take it somewhere its clearance was never checked. The amplitude stays
  // inside that budget, and y is clamped to data-maxy as a hard backstop.
  // One balloon at a time leaves the field. The three still on the ground are
  // #cc-launch-N — ids, so namespaced by inline-assets.py and found by
  // substring. Launching all three together turns the scene into a screensaver;
  // one at a time with a long wait between reads like an event you happened to
  // catch, which is what the handoff asked for.
  //
  // It rises SHRINKING. A balloon climbing away from you does get smaller, and
  // it also settles the composition: on the pitch it is 86x127px, and carrying
  // that up the frame at full size would put a balloon the size of the gate over
  // the top of the picture. Ending at 0.3 leaves it a plausible near neighbour
  // of the drifting ones. They sit in `scenery-back`, which is painted before
  // the road, so the whole climb happens BEHIND the crossing.
  // The cadence is idle + burn + rise, and because only one goes at a time that
  // sum IS the gap between take-offs. 33s felt like waiting; 20s is often enough
  // that a child sees one without it becoming wallpaper. The rise is the big
  // term — shortening it is what actually speeds the scene up.
  const LAUNCH = {
    idle: 2,        // sitting on the pitch, burner ticking over
    burn: 2.5,      // burner up, before she unsticks
    rise: 16,       // to the top of the frame
    top: -20,       // y at the end of the climb — the envelope is clear by then
    shrink: 0.30,   // final scale as a fraction of her size on the ground
    sway: 26,       // how far she wanders sideways on the way up
    shade: 0.35,    // fraction of the climb over which her ground shadow goes
    fade: 1600,     // ms for the whole field to come back at the end of a round
  };

  const BALLOON_SWING = 84;        // px at the nearest depth; data-maxy allows 90
  const BALLOON_BOB = 6;
  const BALLOON_NEAR = 0.46;       // data-s of the nearest airborne balloon

  function buildBalloons(svg) {
    const list = [];
    svg.querySelectorAll('.cc-balloon').forEach(node => {
      const x = parseFloat(node.getAttribute('data-x'));
      const y = parseFloat(node.getAttribute('data-y'));
      const s = parseFloat(node.getAttribute('data-s'));
      if (isNaN(x) || isNaN(y) || isNaN(s)) { console.warn('cc-balloon is missing data-x/y/s'); return; }
      const maxy = parseFloat(node.getAttribute('data-maxy'));
      const i = parseFloat(node.getAttribute('data-i')) || 0;
      const depth = Math.max(0.22, Math.min(1, s / BALLOON_NEAR));
      list.push({
        el: node, x: x, y: y, s: s,
        maxy: isNaN(maxy) ? Infinity : maxy,
        swing: BALLOON_SWING * depth,
        bob: BALLOON_BOB * depth,
        // Periods come from data-i, which is the painting order — stable, so the
        // sky looks the same every run without needing a seeded random.
        tx: 34 + (i % 7) * 3.5, px: (i % 11) / 11,
        ty: 11 + (i % 5) * 1.7, py: (i % 9) / 9,
      });
    });
    // Burners, including the ones on the balloons still standing on the field —
    // an inflating balloon lit from inside is the best thing in the scene, and
    // those are #cc-launch-N rather than .cc-balloon, so scoping through
    // .cc-balloon found only four of the ten.
    //
    // Cape Canaveral's rocket uses .cc-flame as well, and there the flame is a
    // SIBLING of .cc-rocket rather than a child, so closest() cannot tell them
    // apart. A scene has balloons or a rocket, never both, so the honest test is
    // the scene itself. If that ever stops being true the balloons quietly lose
    // their burners, which is the right way round to fail.
    const flames = [];
    if (!svg.querySelector('.cc-rocket')) {
      svg.querySelectorAll('.cc-flame').forEach((f, k) => {
        flames.push({ el: f, period: 2.3 + (k % 6) * 0.47, phase: (k % 7) / 7,
                      base: parseFloat(f.getAttribute('opacity')) || 1 });
      });
    }
    // The pads. Sorted by their trailing number so the rotation is left to
    // right rather than whatever order the document happens to be in.
    // Only pads that carry a balloon. "Launch" is also a small BOAT, and a scene
    // with one of those in it has nothing to do with a mass ascension.
    const pads = [].slice.call(svg.querySelectorAll('[id*="cc-launch-"]'))
      .filter(el => el.classList.contains('cc-balloon') || el.querySelector('.cc-balloon, .cc-flame'))
      .map(el => {
      const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)\s*scale\(\s*([\d.]+)/
        .exec(el.getAttribute('transform') || '');
      if (!m) { console.warn('cc-launch pad has no translate/scale to return to'); return null; }
      const n = /cc-launch-(\d+)/.exec(el.id);
      // Its ground shadow is a sibling — it has to be, or it would fly with her.
      // data-pad holds the un-namespaced gid, so match on the end of the id.
      const shade = [].slice.call(svg.querySelectorAll('.cc-launch-shade'))
        .filter(g => el.id.slice(-g.getAttribute('data-pad').length) === g.getAttribute('data-pad'))[0];
      return { el: el, n: n ? +n[1] : 0, x: +m[1], y: +m[2], s: +m[3],
               flame: el.querySelector('.cc-flame'), shade: shade || null };
    }).filter(Boolean).sort((a, b) => a.n - b.n);

    return list.length
      ? { list: list, flames: flames,
          launch: pads.length ? { pads: pads, i: 0, t: 0, phase: 'fly' } : null }
      : null;
  }

  function updateLaunch(b, secs, dt) {
    const L = b.launch;
    if (!L) return;
    L.t += dt / 1000;

    // THE WHOLE FIELD EMPTIES, THEN REFILLS. Each balloon that goes stays gone
    // until all three have gone, and then they all come back together. Putting
    // one back before the next left meant the pitch was never actually empty,
    // so the ascension never read as one — it was just three balloons taking
    // turns.
    if (L.phase === 'refill') {
      const k = Math.min(1, L.t / (LAUNCH.fade / 1000));
      L.pads.forEach(q => {
        q.el.setAttribute('opacity', k.toFixed(2));
        if (q.shade) q.shade.setAttribute('opacity', k.toFixed(2));
      });
      if (k >= 1) { L.phase = 'fly'; L.i = 0; L.t = 0; }
      return;
    }

    const p = L.pads[L.i];
    if (L.t < LAUNCH.idle) return;          // the shared flame pulse does the idling
    const u = L.t - LAUNCH.idle;

    if (u < LAUNCH.burn) {                  // burner up, still on the ground
      if (p.flame) p.flame.setAttribute('opacity', (0.55 + 0.45 * Math.abs(Math.sin(secs * 9))).toFixed(2));
      return;
    }

    const r = (u - LAUNCH.burn) / LAUNCH.rise;
    if (r >= 1) {                           // gone: park her home but keep her hidden
      p.el.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ') scale(' + p.s + ')');
      p.el.setAttribute('opacity', '0');
      if (p.shade) p.shade.setAttribute('opacity', '0');
      L.i++;
      L.t = 0;
      if (L.i >= L.pads.length) L.phase = 'refill';
      return;
    }

    // Smoothstep, because a balloon does not leap off the ground — it unsticks,
    // then climbs steadily, then appears to slow as it gets far away.
    const e = r * r * (3 - 2 * r);
    const y = p.y + (LAUNCH.top - p.y) * e;
    const s = p.s * (1 - (1 - LAUNCH.shrink) * e);
    const x = p.x + LAUNCH.sway * Math.sin(r * Math.PI * 1.6);
    p.el.setAttribute('transform',
      'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s.toFixed(3) + ')');
    // Her shadow goes early in the climb. It is cast by her sitting on the
    // grass, and a few metres up there is nothing to cast it — leaving it on an
    // empty pitch is what gave the whole thing away.
    if (p.shade) p.shade.setAttribute('opacity', Math.max(0, 1 - r / LAUNCH.shade).toFixed(2));
    if (p.flame) {                          // still burning, easing off as she settles
      const k = Math.max(0, 1 - r * 2.2);
      p.flame.setAttribute('opacity', (0.25 + 0.75 * k * Math.abs(Math.sin(secs * 7))).toFixed(2));
    }
  }

  const TAU = Math.PI * 2;

  function updateBalloons(t, dt) {
    const b = currentScene && currentScene.balloons;
    if (!b) return;
    const secs = t / 1000;
    b.list.forEach(o => {
      const x = o.x + o.swing * Math.sin((secs / o.tx + o.px) * TAU);
      let y = o.y + o.bob * Math.sin((secs / o.ty + o.py) * TAU);
      if (y > o.maxy) y = o.maxy;          // never below its own clearance line
      o.el.setAttribute('transform',
        'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + o.s + ')');
    });
    // The burners: a short bright lick at irregular intervals, not a steady
    // glow. Each is on for about a fifth of its cycle and eased, so it swells
    // and dies rather than blinking.
    b.flames.forEach(f => {
      const u = (secs / f.period + f.phase) % 1;
      const k = u < 0.22 ? Math.sin(u / 0.22 * Math.PI) : 0;
      f.el.setAttribute('opacity', (f.base * (0.22 + 0.78 * k)).toFixed(2));
    });
    // After the shared pulse, so the one that is launching can override it.
    updateLaunch(b, secs, dt);
  }

  // =======================================================================
  // Falling water (.cc-fall) and the boil under it (.cc-foam).
  //
  // The art draws the streaks as a band that TILES vertically and emits it
  // twice, the second copy one band-height above the first. Sliding the pair
  // down by exactly one band puts the second copy where the first started, so
  // it loops with no seam — one transform a frame for the whole waterfall.
  //
  // The band is clipped to the BROKEN part of the sheet rather than the whole
  // face, because at the lip the water is still glassy; streaks scrolling over
  // the crest stop it reading as an edge at all.
  function buildFalls(svg) {
    const bands = [];
    svg.querySelectorAll('.cc-fall').forEach(node => {
      const band = parseFloat(node.getAttribute('data-band'));
      if (!band) { console.warn('cc-fall has no data-band to loop over'); return; }
      bands.push({ el: node, band: band,
                   secs: parseFloat(node.getAttribute('data-secs')) || 0.8 });
    });
    // Split in three by the art so the boil churns out of step with itself
    // rather than breathing as one lump.
    const foam = [];
    svg.querySelectorAll('.cc-foam').forEach((node, k) => {
      foam.push({ el: node, period: 1.7 + k * 0.63, phase: k / 3 });
    });
    // EITHER is enough. It used to need a falling band, which is right for a
    // waterfall and wrong for a fountain: Kansas City has sheets over two basin
    // lips and a pool that shifts, and nothing pouring in a straight line.
    return (bands.length || foam.length) ? { bands: bands, foam: foam } : null;
  }

  function updateFalls(t) {
    const f = currentScene && currentScene.falls;
    if (!f) return;
    const secs = t / 1000;
    f.bands.forEach(b => {
      b.el.setAttribute('transform',
        'translate(0,' + ((secs / b.secs % 1) * b.band).toFixed(1) + ')');
    });
    f.foam.forEach(o => {
      const u = Math.sin((secs / o.period + o.phase) * TAU);
      o.el.setAttribute('opacity', (0.72 + 0.28 * u).toFixed(2));
      o.el.setAttribute('transform', 'translate(0,' + (u * 1.4).toFixed(1) + ')');
    });
  }

  // =======================================================================
  // THE DETROIT SHUNTING MOVE — the one place where the railway is the subject
  // rather than scenery, so the train does something instead of just passing.
  //
  //   the train runs in and brakes to a stand
  //   a loaded auto-rack rolls down off the siding onto the main line
  //   it settles on the back of the train
  //   the train pulls away one wagon longer
  //
  // A scene opts in simply by having #cc-autorack-N groups standing on a siding.
  // Nothing else in the game changes; every other place still runs a train
  // straight through.
  //
  // TWO THINGS THIS MUST NOT DO.
  //
  // It must not touch the child's train. The extra wagon is passed to
  // buildConsist as a scene-local extra and never written to CC.trains, so it
  // cannot follow them to the next place or survive a reload — a location does
  // not get to redecorate what they built.
  //
  // And it must not couple to the gate. The gate is the game; this is the train
  // going about its business behind it. The child can raise the gate mid-shunt
  // and nothing here cares.
  //
  // The wagon that rolls down is the CONSIST'S OWN element, not the scene's
  // artwork, animated from the siding to its coupling slot. The alternative —
  // animating the scene's rack and swapping at the end — means matching two
  // different drawings pixel for pixel at the one moment anybody is looking.
  // Doing it this way there is a single art change, at the START of the roll,
  // at the same place and the same size, while the wagon is small and far away.
  // The crane does the work now, so the sequence is a list of timed steps rather
  // than one slide. Each is a plain lerp; the order is what makes it read as a
  // machine picking something up. Kept tight on purpose — the train stands still
  // for the whole of it, and about seven seconds is the limit before a small
  // child stops watching and starts pressing buttons.
  // =======================================================================
  // Calling at a station (.cc-platform + .cc-passenger).
  //
  // The same shape as the shunt, and for the same reason: the train's speed is
  // already a 0..1 factor, so stopping it is a factor, not a second way to move
  // a train. And like the shunt it is GATE-BLIND — the gate is the game, and a
  // child who cannot work their toy while a train sits at a platform has been
  // given a cutscene instead.
  //
  // The boarding side faces the viewer, so the passengers walk in FRONT of the
  // coaches and stay visible the whole way. They step aboard by reaching the
  // coach and fading; the ones getting off fade in there and walk away.
  const HALT = {
    lead: 1.0,       // stand still a beat before anyone moves
    change: 0.5,     // and a beat on the platform before walking to the bus
    // The second leg is SHORT — platform to bus door is about fifty pixels where
    // coach door to platform is a hundred and fifty — so it gets its own time
    // rather than the full crossing. With the shared 2.6 the last person to
    // change was still walking when the train pulled out and got snapped back to
    // the coach door by the reset.
    hop: 1.6,
    walk: 2.6,       // seconds to cross the platform
    bob: 1.6,        // px they rise and fall, so they walk rather than slide
    steps: 3.4,      // bobs per second
  };

  function buildHalt(svg) {
    const mark = svg.querySelector('.cc-platform');
    if (!mark) return null;
    const stop = parseFloat(mark.getAttribute('data-stop'));
    if (isNaN(stop)) { console.warn('cc-platform has no usable data-stop'); return null; }
    const people = [];
    svg.querySelectorAll('.cc-passenger').forEach(el => {
      const a = (el.getAttribute('data-stand') || '').split(',').map(Number);
      const b = (el.getAttribute('data-door') || '').split(',').map(Number);
      if (a.length !== 2 || b.length !== 2 || a.concat(b).some(isNaN)) return;
      // A THIRD LEG, for the ones who are changing. They get off, walk out onto
      // the platform like everybody else, and then carry on down to the bus.
      const c = (el.getAttribute('data-bus') || '').split(',').map(Number);
      const bus = (c.length === 2 && !c.some(isNaN)) ? { x: c[0], y: c[1] } : null;
      people.push({ el: el, sx: a[0], sy: a[1], dx: b[0], dy: b[1], bus: bus,
                    board: el.getAttribute('data-role') !== 'alight',
                    s: parseFloat(el.getAttribute('data-scale')) || 1,
                    // staggered, so five people do not move as one block
                    delay: people.length * 0.45 });
    });
    return { stopHead: stop, dwell: parseFloat(mark.getAttribute('data-dwell')) || 6,
             people: people };
  }

  /** Put everyone back where they started: boarders on the platform, the ones
      who got off waiting invisibly at the coach side for the next train. */
  function resetPlatform(h) {
    if (!h) return;
    h.people.forEach(p => {
      const x = p.board ? p.sx : p.dx, y = p.board ? p.sy : p.dy;
      p.el.setAttribute('transform', 'translate(' + x + ',' + y + ') scale(' + p.s + ')');
      p.el.setAttribute('opacity', p.board ? '1' : '0');
    });
  }

  function haltSpeed() {
    const s = train.halt;
    if (!s) return 1;
    if (s.phase === 'run') {
      // Signed, because a halt can run either way: the coaches trail BEHIND the
      // loco, so which direction the train comes from decides whether they end
      // up over the platform or a hundred metres short of it.
      const togo = (s.stopHead - train.head) * train.dir;
      if (togo <= 0) { s.phase = 'stand'; s.t = 0; return 0; }
      return Math.max(0.04, Math.min(1, togo / SHUNT.brake));
    }
    if (s.phase === 'away') return Math.min(1, s.t / SHUNT.accel);
    return 0;
  }

  function updateHalt(dt) {
    const s = train.halt;
    if (!s || s.phase === 'run') return;
    s.t += dt / 1000;
    if (s.phase === 'stand' && s.t >= s.dwell) { s.phase = 'away'; s.t = 0; }
    if (s.phase !== 'stand') return;

    let changing = 0, aboard = 0;
    s.people.forEach(p => {
      const u = Math.max(0, Math.min(1, (s.t - HALT.lead - p.delay) / HALT.walk));
      // THE CHANGE. Once they are out on the platform they wait a beat and walk on
      // to the bus, fading as they step aboard. Two separate legs and not one long
      // diagonal: they came out of a coach door and they are going to a bus door,
      // and a straight line between those two goes through the platform edge.
      if (p.bus) {
        changing++;
        const v = Math.max(0, Math.min(1, (s.t - HALT.lead - p.delay - HALT.walk - HALT.change) / HALT.hop));
        if (u >= 1) {
          const x = p.sx + (p.bus.x - p.sx) * v;
          const y = p.sy + (p.bus.y - p.sy) * v;
          const moving = v > 0 && v < 1;
          const bob = moving ? -Math.abs(Math.sin(s.t * HALT.steps * Math.PI)) * HALT.bob : 0;
          p.el.setAttribute('transform',
            'translate(' + x.toFixed(1) + ',' + (y + bob).toFixed(1) + ') scale(' + p.s + ')');
          p.el.setAttribute('opacity', Math.min(1, (1 - v) / 0.2).toFixed(2));
          if (v >= 1) aboard++;
          return;
        }
      }
      // Boarders go platform -> coach and fade out as they step up; the ones
      // getting off appear at the coach and walk out onto the platform.
      // k is "how far toward the platform", so it runs 1->0 for someone getting
      // ON and 0->1 for someone getting OFF. Written the other way round first,
      // which teleported the boarders to the coach and walked them backwards.
      const k = p.board ? 1 - u : u;
      const x = p.dx + (p.sx - p.dx) * k;
      const y = p.dy + (p.sy - p.dy) * k;
      const moving = u > 0 && u < 1;
      const bob = moving ? -Math.abs(Math.sin(s.t * HALT.steps * Math.PI)) * HALT.bob : 0;
      p.el.setAttribute('transform',
        'translate(' + x.toFixed(1) + ',' + (y + bob).toFixed(1) + ') scale(' + p.s + ')');
      p.el.setAttribute('opacity',
        (p.board ? Math.min(1, (1 - u) / 0.18) : Math.min(1, u / 0.18)).toFixed(2));
    });

    // Everybody who was changing is aboard: the bus can go. It leaves on its own
    // clock from here, because the train pulls out at about the same moment and
    // train.halt is thrown away with it.
    const b = currentScene && currentScene.busStop;
    if (b && changing && aboard >= changing && b.phase === 'wait') b.phase = 'pull';
  }

  // =======================================================================
  // THE BUS AT THE STOP (.cc-bus-stop) — the far end of a transfer.
  //
  //   data-bay    where it stands, which is the x the art drew it at
  //   data-away   the x it has left the frame by
  //   data-speed  px/s   ·   data-lead  a beat before it pulls out
  //   data-gone   seconds before the next one is at the stop
  //
  // It only ever drives FORWARDS and it only ever drives one way — the art faces
  // it away from the crossing so its whole route is clear pavement, and it never
  // has to give way to the engine's road cars or know the gate exists.
  //
  // The one honest cheat: the next bus FADES IN at the stop rather than driving
  // in from the left, because driving in would mean crossing the near road
  // against the traffic the engine is already running there. A route has many
  // buses and nobody is following this one, and it happens with the platform
  // empty between trains.
  // =======================================================================
  function buildBusStop(svg) {
    const el = svg.querySelector('.cc-bus-stop');
    if (!el) return null;
    const n = (k, d) => { const v = parseFloat(el.getAttribute(k)); return isNaN(v) ? d : v; };
    const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)\s*(scale\([^)]*\))?/
      .exec(el.getAttribute('transform') || '');
    if (!m) { console.warn('.cc-bus-stop has no usable transform'); return null; }
    return { el: el, y: +m[2], sc: m[3] || '', bay: n('data-bay', +m[1]),
             away: n('data-away', 1470), speed: n('data-speed', 165),
             lead: n('data-lead', 1), gone: n('data-gone', 7),
             x: n('data-bay', +m[1]), phase: 'wait', t: 0 };
  }

  function placeBus(b, fade) {
    b.el.setAttribute('transform', 'translate(' + b.x.toFixed(1) + ',' + b.y + ') ' + b.sc);
    b.el.setAttribute('opacity', fade.toFixed(2));
  }

  function updateBusStop(dt) {
    const b = currentScene && currentScene.busStop;
    if (!b) return;
    const secs = dt / 1000;
    if (b.phase === 'wait') { placeBus(b, 1); return; }
    if (b.phase === 'pull') {                       // doors close, then away
      b.t += secs;
      if (b.t >= b.lead) { b.phase = 'away'; b.t = 0; }
      placeBus(b, 1);
    } else if (b.phase === 'away') {
      b.x += b.speed * secs;
      if (b.x >= b.away) { b.phase = 'gone'; b.t = 0; b.x = b.bay; }
      placeBus(b, 1);
    } else if (b.phase === 'gone') {                // the next one is along shortly
      b.t += secs;
      placeBus(b, Math.max(0, Math.min(1, (b.t - b.gone) / 1.1)));
      if (b.t >= b.gone + 1.1) { b.phase = 'wait'; b.t = 0; }
    }
  }

  const SHUNT = {
    brake: 300,     // px over which the train slows to a stand
    accel: 1.8,     // s back up to line speed
    lead: 26,       // px further along the rail the wagon is set down
    lift: 30,       // px the hook raises it before traversing
    park: 150,      // where the trolley sits when it has nothing to do
    steps: [        // name, seconds
      ['hold',    0.5],   // train stands, crane already overhead (see 'run')
      ['lower',   0.7],   // hook down onto the rack
      ['grab',    0.3],
      ['hoist',   0.6],   // up off the siding
      ['carry',   2.2],   // trolley traverses to the train, load swinging under it
      ['place',   1.0],   // down onto the rail, growing as it comes nearer
      ['release', 0.4],
      ['settle',  0.5],   // hook clear, couplings made
    ],
  };

  /** Stand the REAL wagon on the siding, in place of the drawing.

      The authored racks are a mix of enclosed vans and open cages, and whichever
      one gets picked has to turn into the consist's auto-rack. Matching two
      different drawings pixel for pixel at the one moment anybody is looking at
      them was never going to work — parked it was a closed brown box, and the
      instant it moved it became an open cage full of cars.

      So the parked racks ARE the wagon. Each authored group steps aside and a
      `wagon-autorack` takes its place, scaled to occupy exactly the same length
      of siding as the drawing it replaces. Same art parked as rolling, so there
      is nothing left to hide.

      Must run with the scene in the document: the match is done from bounding
      boxes and getBBox on a detached node is all zeros. */
  // =======================================================================
  // A barrier the road traffic actually uses (.cc-plant-boom).
  //
  // Detroit's road stops at the plant gate, and the boom hung permanently down
  // across it while the works traffic drove up and vanished straight through —
  // which is exactly the sort of thing a small child spots first.
  //
  // It lifts for a car on its way in and drops again behind it. That is the
  // whole trick: the fade-out at the end of the road stops being a car
  // disappearing and becomes a car going through a gate.
  //
  // NOT the crossing gate, and nothing to do with it. That one is the game.
  const BOOM = { up: 70, secs: 0.55, watch: 130 };   // degrees, travel time, how far ahead it sees

  function buildBoom(svg) {
    const el = svg.querySelector('.cc-plant-boom');
    if (!el) return null;
    // Two spellings in the wild: Detroit's data-pivot="x,y" and Mystic's
    // separate data-pivot-x / data-pivot-y. Accept either.
    let px = parseFloat(el.getAttribute('data-pivot-x'));
    let py = parseFloat(el.getAttribute('data-pivot-y'));
    if (isNaN(px) || isNaN(py)) {
      const p = (el.getAttribute('data-pivot') || '').split(',').map(Number);
      if (p.length !== 2 || p.some(isNaN)) { console.warn('cc-plant-boom has no usable pivot'); return null; }
      px = p[0]; py = p[1];
    }
    // The arm may be a child (Mystic) or the group itself (Detroit).
    const arm = el.querySelector('.cc-boom-arm') || el;
    return { el: arm, px: px, py: py, a: 0,
             down: parseFloat(el.getAttribute('data-down-deg')),
             up: parseFloat(el.getAttribute('data-up-deg')) };
  }

  function updateBoom(dt) {
    const b = currentScene && currentScene.boom;
    // A bascule owns its own approach barrier and drives it from the lift
    // sequence, not from the traffic. Detroit's lifts FOR cars; Mystic's drops
    // to STOP them. Same class, opposite job — so whoever owns it, drives it.
    if (!b || (currentScene && currentScene.bascule)) return;
    const top = currentScene.roadTop;
    // Only traffic heading AWAY from us is going into the plant; a car coming
    // down the road has already been through.
    const coming = cars.some(c => c.dir < 0 && c.phase === 'road' && c.y < top + BOOM.watch);
    const want = coming ? BOOM.up : 0;
    const step = BOOM.up * dt / 1000 / BOOM.secs;
    b.a += Math.max(-step, Math.min(step, want - b.a));
    b.el.setAttribute('transform',
      'rotate(' + b.a.toFixed(1) + ',' + b.px + ',' + b.py + ')');
  }

  /** The crane. The girder and trolley are in the artwork; the cables and the
      spreader are built HERE, into the train's own layer, because they have to
      share depth with the wagon they are carrying. Left in the scenery layer
      they would be drawn behind the rails while the wagon hung in front. */
  function buildCrane(svg, trainG) {
    const g = svg.querySelector('.cc-crane');
    const trolley = svg.querySelector('.cc-crane-trolley');
    if (!g || !trolley) return null;
    const girder = parseFloat(g.getAttribute('data-girder'));
    if (isNaN(girder)) { console.warn('.cc-crane has no data-girder'); return null; }
    const hoist = el('g', { class: 'cc-hoist', visibility: 'hidden' });
    const rope = () => el('line', { stroke: '#33414c', 'stroke-width': 3, 'stroke-linecap': 'round' });
    const l1 = rope(), l2 = rope();
    const beam = el('rect', { rx: 3, fill: '#e8a81f', height: 11 });
    const beam2 = el('rect', { rx: 3, fill: '#f7cf62', height: 4 });
    [l1, l2, beam, beam2].forEach(e => hoist.appendChild(e));
    trainG.appendChild(hoist);
    return { trolley: trolley, hoist: hoist, l1: l1, l2: l2, beam: beam, beam2: beam2,
             girder: girder, x: SHUNT.park };
  }

  /** Put the trolley at x, and hang the spreader at `top` over a load `halfW` wide. */
  function setCrane(c, x, top, halfW) {
    c.x = x;
    c.trolley.setAttribute('transform', 'translate(' + x.toFixed(1) + ',0)');
    if (top == null) { c.hoist.setAttribute('visibility', 'hidden'); return; }
    c.hoist.setAttribute('visibility', 'visible');
    c.l1.setAttribute('x1', x - 13); c.l1.setAttribute('y1', c.girder);
    c.l1.setAttribute('x2', x - halfW); c.l1.setAttribute('y2', top);
    c.l2.setAttribute('x1', x + 13); c.l2.setAttribute('y1', c.girder);
    c.l2.setAttribute('x2', x + halfW); c.l2.setAttribute('y2', top);
    c.beam.setAttribute('x', x - halfW - 8); c.beam.setAttribute('y', top - 6);
    c.beam.setAttribute('width', halfW * 2 + 16);
    c.beam2.setAttribute('x', x - halfW - 8); c.beam2.setAttribute('y', top - 6);
    c.beam2.setAttribute('width', halfW * 2 + 16);
  }

  /** The two dialects a scene can use to offer the crane something to lift.
      They grew independently, in two scenes, and both are on disk now:

        Detroit — the authored group's own transform IS the placement, and its
                  origin already sits in the middle of the wagon.
        Bailey  — authored at translate(leftEnd, railY) and labelled with the
                  middle it wants, because our rolling stock hangs off its
                  middle. It also says what KIND of wagon it is, so the yard can
                  hold a mix and the train gets whichever one is lifted. */
  const RACK_KINDS = [
    { sel: '[id*="cc-autorack-"]', num: /cc-autorack-(\d+)/,
      type: () => 'wagon-autorack',
      at: (el, t) => ({ x: t.x, y: t.y }),
      // Detroit's racks are drawn to a size the scene chose; match the drawing.
      size: (t, drawn, gb) => gb.width ? (drawn.width * t.s) / gb.width : t.s },
    { sel: '[id*="cc-crane-wagon-"]', num: /cc-crane-wagon-(\d+)/,
      type: el => 'wagon-' + (el.getAttribute('data-kind') || 'boxcar'),
      at: (el, t) => ({ x: attrNum(el, 'data-centre-x', t.x),
                        y: attrNum(el, 'data-rail-y', t.y) }),
      // Bailey's are sized by DEPTH, exactly as the train is, so a wagon standing
      // on the loading track and the same wagon rolling on the main line below
      // cannot disagree. Drawn to the scene's own taste they came out half again
      // longer than the train they were about to join, on a track further away.
      size: (t, drawn, gb, spot) => depthScale(spot.y) },
  ];

  function attrNum(el, name, dflt) {
    const v = parseFloat(el.getAttribute(name));
    return isNaN(v) ? dflt : v;
  }

  /** A rack stands where its own record says it stands. `x` is the LIVE middle,
      so the yard crane moves one simply by writing a new number into it. */
  function placeRack(r) {
    r.el.setAttribute('transform', 'translate(' + r.x.toFixed(1) + ',' + r.y.toFixed(1)
      + ') scale(' + r.s.toFixed(4) + ')');
  }

  function buildRacks(svg) {
    const racks = [];
    RACK_KINDS.forEach(kind => {
      svg.querySelectorAll(kind.sel).forEach(el => {
        // The scale is optional: Detroit's racks carry one, Bailey's are drawn
        // at full size and have none.
        const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)(?:\s*scale\(\s*([\d.]+))?/
          .exec(el.getAttribute('transform') || '');
        if (!m) return;
        const drawn = el.getBBox();
        if (!drawn.width) { console.warn(el.id + ' has no size — is the scene attached?'); return; }
        const t = { x: +m[1], y: +m[2], s: m[3] ? +m[3] : 1 };
        const spot = kind.at(el, t);
        const type = kind.type(el);
        const n = kind.num.exec(el.id);
        const g = CC.rolling.build(type);
        el.parentNode.insertBefore(g, el);
        const gb = g.getBBox();
        // Same footprint on the siding as the drawing it stands in for. Both put
        // y=0 on the rail, so the translate carries straight over.
        const s2 = kind.size(t, drawn, gb, spot);
        el.setAttribute('visibility', 'hidden');
        // roofU is the wagon's own height above the rail, in ITS units, so the
        // hook can find the roof at any scale. It used to be the number 140,
        // which was right for an auto-rack and for nothing else.
        const r = { el: g, n: n ? +n[1] : 0, x: spot.x, y: spot.y, s: s2,
                    type: type, roofU: -gb.y };
        placeRack(r);
        racks.push(r);
      });
    });
    racks.sort((a, b) => a.n - b.n);
    return racks.length ? racks : null;
  }

  /** Set the shunt up for this run, or return null if it will not fit.

      Two things have to be true at once. The ENGINE must still be on screen when
      the train stops — with a long consist the tail is most of the frame behind
      the head, so a careless choice parks the locomotive off the right-hand edge
      where nobody can see the thing it is doing. And the crane must have a
      journey worth watching: the first version stopped the train right beside
      the rack it was going to lift, so the load travelled 26px and the whole
      crane looked pointless.

      So the coupling slot is placed first, near the left of the frame with the
      engine comfortably inside it, and then the rack is chosen for the length of
      the carry rather than for being nearby. */
  const CARRY_WANT = 560;               // px of traverse that reads as a crane working

  function planShunt(pin) {
    const racks = currentScene && currentScene.racks;
    if (!racks || train.items.length < 2) return null;
    const last = train.items[train.items.length - 1];
    const tail = -last.offset * TRAIN_S;          // how far the slot sits behind the head
    const stopHead = clamp(tail + 210, 700, W - 150);
    const slot = stopHead - tail;
    if (slot < 40) return null;                   // consist too long to fit the move
    // `pin` re-plans around a wagon already chosen — see launchTrain, where the
    // consist has to be rebuilt once the crane's pick turns out to be a
    // different kind of wagon from the one we guessed.
    let best = pin || null, bestErr = Infinity;
    if (!best) racks.forEach(r => {
      const err = Math.abs(Math.abs(r.x - slot) - CARRY_WANT);
      if (err < bestErr) { bestErr = err; best = r; }
    });
    if (!best) return null;
    // How high the load rides across the yard. Detroit's racks stand alone on a
    // siding the crane leaves at once, so 30px of daylight is plenty. Bailey's
    // four stand in a ROW on one loading track and the carry goes straight over
    // the top of them — at 30px the wagon would sail through its neighbours.
    const clear = racks.reduce((a, r) => Math.max(a, r.roofU * r.s), 0) + 14;
    return { rack: best, phase: 'run', t: 0, picked: false,
             pickIndex: train.items.length - 1,
             rollingIndex: -1,          // set only while it drives its own transform
             stopHead: stopHead,
             lift: currentScene.gantry ? clear : SHUNT.lift,
             targetX: slot };
  }

  /** How fast the train may go right now: 1 normally, 0 while it stands. */
  function shuntSpeed(dt) {
    const s = train.shunt;
    if (!s) return 1;
    if (s.phase === 'run') {
      const togo = s.stopHead - train.head;
      if (togo <= 0) { s.phase = 'work'; s.t = 0; return 0; }
      return Math.max(0.05, Math.min(1, togo / SHUNT.brake));
    }
    if (s.phase === 'away') return Math.min(1, s.t / SHUNT.accel);
    return 0;
  }

  /** Seconds into the step list at which each step starts. */
  function stepAt(name) {
    let a = 0;
    for (const s of SHUNT.steps) { if (s[0] === name) return a; a += s[1]; }
    return a;
  }
  const SHUNT_TOTAL = SHUNT.steps.reduce((a, s) => a + s[1], 0);

  /** 0..1 through the named step, clamped. */
  function stepT(u, name) {
    const at = stepAt(name), dur = (SHUNT.steps.find(s => s[0] === name) || [0, 1])[1];
    return clamp((u - at) / dur, 0, 1);
  }

  const ease = (r) => r * r * (3 - 2 * r);

  /** Where the hook is now, whichever crane this scene owns. */
  function craneX() {
    const c = currentScene.crane, g = currentScene.gantry;
    return c ? c.x : g ? g.x : 0;
  }

  /** The girder the hook hangs from — the line it returns to with nothing on it. */
  function craneTop() {
    const c = currentScene.crane, g = currentScene.gantry;
    return c ? c.girder : g ? g.topY : 0;
  }

  /** Put the hook at x with a load whose roof is at `top` (null: nothing on it).

      Detroit's crane has no ropes or spreader in the artwork, so `setCrane`
      draws them. Bailey's are real, drawn, named parts — using Detroit's path
      there would hang a second spreader over the top of a perfectly good one.
      Each scene's own hardware does the job. */
  function shuntHook(x, top, halfW) {
    const c = currentScene.crane, g = currentScene.gantry;
    if (c) { setCrane(c, x, top, halfW); return; }
    if (!g) return;
    g.x = x;
    g.y = top == null ? g.homeY : top;
    setGantry(g);
  }

  function updateShunt(dt) {
    const s = train.shunt;
    if (!s) return;
    const c = currentScene.crane;

    // While the train is still running in, the crane goes and stands over the
    // rack it is going to lift. By the time the train stops it is in position,
    // which saves a couple of seconds of everybody waiting and looks like the
    // yard knew the train was coming.
    if (s.phase === 'run') {
      if (c || currentScene.gantry) {
        const to = s.rack.x, at = craneX();
        const step = 300 * dt / 1000;
        shuntHook(at + clamp(to - at, -step, step), null, 0);
      }
      return;
    }
    if (s.phase === 'away') { s.t += dt / 1000; return; }

    s.t += dt / 1000;
    const u = s.t;
    const g = train.els[s.pickIndex];

    // Hand-over happens at 'grab', at the rack's own place and scale, so there
    // is nothing to see: the parked rack IS a wagon-autorack.
    if (!s.picked && u >= stepAt('grab')) {
      s.picked = true;
      s.rollingIndex = s.pickIndex;
      s.rack.el.setAttribute('visibility', 'hidden');
      g.setAttribute('visibility', 'visible');
      CC.audio.honk && CC.audio.honk();
    }

    // Where the load is, step by step.
    const lifted = (s.lift || SHUNT.lift) * ease(stepT(u, 'hoist'));
    const carry = ease(stepT(u, 'carry'));
    const place = ease(stepT(u, 'place'));
    const x = s.rack.x + (s.targetX - s.rack.x) * carry;
    const yUp = s.rack.y - lifted;
    const y = yUp + (RAIL_Y - yUp) * place;
    const sc = s.rack.s + (TRAIN_S - s.rack.s) * place;

    if (s.picked) {
      g.setAttribute('transform',
        'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + sc.toFixed(3) + ')');
      CC.rolling.roll(g, (x - s.rack.x) / TRAIN_S, train.items[s.pickIndex].type);
    }

    if (c || currentScene.gantry) {
      // The hook comes down onto the rack, rides with it, and lifts clear again.
      const down = ease(stepT(u, 'lower'));
      const off = ease(stepT(u, 'release'));
      const top = y - s.rack.roofU * sc;              // the wagon's roof
      const girder = craneTop();
      const hookY = girder + (top - girder) * down * (1 - off);
      shuntHook((s.picked || down > 0) ? x : craneX(), down > 0 ? hookY : null, 82 * sc);
    }

    if (u >= SHUNT_TOTAL) {
      s.phase = 'away'; s.t = 0; s.rollingIndex = -1;
      shuntHook(craneX(), null, 0);
      CC.audio.whistle();
    }
  }

  // =======================================================================
  // A geyser (.cc-geyser). The cone is permanent; the column is not.
  //
  // The WAITING is most of what makes a geyser a geyser — one that is always at
  // full height is a fountain. So it sits quiet with a wisp at the vent for a
  // good while, climbs, stands, and falls back. data-origin is the mouth, and
  // everything scales about that point so the column grows OUT of the vent
  // rather than inflating around its own middle.
  // A 27-second cycle spent 15 of them doing nothing, so most of the time a
  // child looked at Yellowstone the hero of the scene was off. Now ~16, and the
  // rise is quicker because that is what a geyser does — it jets, it does not
  // inflate.
  const GEYSER = { quiet: 6, rise: 1.8, hold: 5, fall: 3, low: 0.13 };

  function buildGeysers(svg) {
    const out = [];
    svg.querySelectorAll('.cc-geyser').forEach(node => {
      const o = (node.getAttribute('data-origin') || '').split(',').map(Number);
      if (o.length !== 2 || o.some(isNaN)) { console.warn('cc-geyser has no usable data-origin'); return; }
      out.push({ el: node, ox: o[0], oy: o[1] });
    });
    return out;
  }

  function updateGeysers(t) {
    const list = currentScene && currentScene.geysers;
    if (!list || !list.length) return;
    const span = GEYSER.quiet + GEYSER.rise + GEYSER.hold + GEYSER.fall;
    list.forEach((g, i) => {
      // Offset by index so two geysers in one scene would never go together.
      let u = (t / 1000 + i * span * 0.37) % span;
      let k;
      if (u < GEYSER.quiet) k = GEYSER.low;
      else if ((u -= GEYSER.quiet) < GEYSER.rise) {
        const r = u / GEYSER.rise;                       // ease out: it leaves fast, then eases
        k = GEYSER.low + (1 - GEYSER.low) * (1 - (1 - r) * (1 - r));
      } else if ((u -= GEYSER.rise) < GEYSER.hold) k = 1;
      else {
        const r = Math.min(1, (u - GEYSER.hold) / GEYSER.fall);
        k = GEYSER.low + (1 - GEYSER.low) * (1 - r) * (1 - r);
      }
      g.el.setAttribute('transform',
        'translate(' + g.ox + ',' + g.oy + ') scale(' + k.toFixed(3) + ') translate(' + (-g.ox) + ',' + (-g.oy) + ')');
      g.el.setAttribute('opacity', (0.45 + 0.55 * k).toFixed(2));
    });
  }

  // =======================================================================
  // The aurora (.cc-aurora). Each direct child — the two curtains, the bright
  // ray, the pink flecks — drifts and fades on its own slow cycle. Moved
  // together at one rate the whole thing reads as a single sheet sliding
  // sideways, which is the one thing an aurora never looks like.
  function buildAurora(svg) {
    const root = svg.querySelector('.cc-aurora');
    if (!root) return null;
    const bands = [];
    [].forEach.call(root.children, (el, i) => {
      const o = parseFloat(el.getAttribute('opacity'));
      bands.push({ el: el, base: isNaN(o) ? 1 : o,
                   ax: 12 + (i % 4) * 7, tx: 19 + (i % 5) * 4.3, px: (i % 7) / 7,
                   to: 13 + (i % 3) * 5.1, po: (i % 5) / 5 });
    });
    return bands.length ? bands : null;
  }

  function updateAurora(t) {
    const bands = currentScene && currentScene.aurora;
    if (!bands) return;
    const secs = t / 1000;
    bands.forEach(b => {
      const dx = b.ax * Math.sin((secs / b.tx + b.px) * TAU);
      const k = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin((secs / b.to + b.po) * TAU));
      b.el.setAttribute('transform', 'translate(' + dx.toFixed(1) + ',0)');
      b.el.setAttribute('opacity', (b.base * k).toFixed(3));
    });
  }

  // =======================================================================
  // A horse that actually gallops (.cc-canter).
  //
  // This only exists because the art draws each leg as its own path. Sliding a
  // horse across a field looks worse than leaving it standing, so the legs are
  // wrapped in .cc-leg with the joint they swing from and the engine turns them.
  //
  // The root carries the horse along the field; .cc-canter-body inside it takes
  // the bob and the pitch, so the shadow — which sits OUTSIDE that group — stays
  // flat on the grass instead of bouncing along with her.
  //
  // Stride is measured in DISTANCE, not seconds, so the legs cannot pedal
  // independently of how fast she is actually going. That mismatch is what makes
  // most walk cycles look wrong.
  const CANTER = {
    // SMALL. These legs are rigid — the knee and hock are drawn into the path —
    // so a big swing pivoting at the shoulder is a pendulum, not a stride. The
    // first attempt used 24 degrees and the horse read as a rocking horse.
    swing: 13,      // degrees each leg swings through
    stride: 78,     // local units per stride — the length of her own barrel
    bob: 2.4,       // local units the body lifts
    rock: 1.8,      // degrees it pitches
    hold: 1.4,      // pause at the fence before turning back
    // FOUR beats, properly spread. DOM order is far-hind, far-fore, near-hind,
    // near-fore, and no two may be in step: at 0/0.5/0.12/0.62 the near pair
    // lagged the far pair by an eighth of a stride, which the eye reads as both
    // sides moving together.
    phase: [0, 0.38, 0.19, 0.57],
  };

  function buildCanters(svg) {
    const out = [];
    svg.querySelectorAll('.cc-canter').forEach(node => {
      const v = (node.getAttribute('data-run') || '').split(',').map(Number);
      if (v.length !== 3 || v.some(isNaN)) { console.warn('cc-canter has no usable data-run'); return; }
      out.push({
        el: node,
        body: node.querySelector('.cc-canter-body'),
        legs: [].map.call(node.querySelectorAll('.cc-leg'), (el, i) => {
          const p = (el.getAttribute('data-pivot') || '0,0').split(',').map(Number);
          return { el: el, px: p[0] || 0, py: p[1] || 0,
                   ph: CANTER.phase[i % CANTER.phase.length] };
        }),
        x0: Math.min(v[0], v[1]), x1: Math.max(v[0], v[1]),
        x: v[0], dir: v[1] > v[0] ? 1 : -1,
        y: parseFloat(node.getAttribute('data-y')) || 0,
        s: parseFloat(node.getAttribute('data-scale')) || 1,
        nose: parseFloat(node.getAttribute('data-nose')) || 1,
        speed: parseFloat(node.getAttribute('data-speed')) || 74,
        // A stride is the length of the animal, so it cannot be one number for
        // everything that walks. A horse covers its own barrel; a hiker with
        // 13-unit legs taking a horse's 78 would moonwalk.
        stride: parseFloat(node.getAttribute('data-stride')) || CANTER.stride,
        gait: 0, turn: 0,
      });
    });
    return out;
  }

  function updateCanters(dt) {
    const list = currentScene && currentScene.canters;
    if (!list || !list.length) return;
    const secs = dt / 1000;
    list.forEach(h => {
      if (h.turn > 0) {
        h.turn -= secs;
        if (h.turn <= 0) { h.dir = -h.dir; h.turn = 0; }
      } else {
        const step = h.speed * secs;
        h.x += step * h.dir;
        h.gait += step / (h.stride * h.s);            // strides covered, not time elapsed
        if (h.x > h.x1) { h.x = h.x1; h.turn = CANTER.hold; }
        else if (h.x < h.x0) { h.x = h.x0; h.turn = CANTER.hold; }
      }
      const facing = h.dir > 0 ? 1 : -1;
      const sx = (facing !== h.nose ? -h.s : h.s);
      h.el.setAttribute('transform',
        'translate(' + h.x.toFixed(1) + ',' + h.y + ') scale(' + sx + ',' + h.s + ')');
      // Pulled up at the fence she stands still, legs and all.
      const g = h.gait * TAU;
      const moving = h.turn <= 0;
      if (h.body) {
        const bob = moving ? -Math.abs(Math.sin(g)) * CANTER.bob : 0;
        const rock = moving ? Math.sin(g) * CANTER.rock : 0;
        h.body.setAttribute('transform',
          'translate(0,' + bob.toFixed(2) + ') rotate(' + rock.toFixed(2) + ',0,-70)');
      }
      h.legs.forEach(L => {
        const a = moving ? CANTER.swing * Math.sin(g + L.ph * TAU) : 0;
        L.el.setAttribute('transform', 'rotate(' + a.toFixed(1) + ',' + L.px + ',' + L.py + ')');
      });
    });
  }

  // =======================================================================
  // Rock-crawling (.cc-crawl). A vehicle that walks a drawn polyline and takes
  // its PITCH from the ground under it — Moab's jeep going up over the block
  // and down the far face, which is what people actually go there to do.
  //
  // Unlike .cc-route, which only knows about x, this needs the two dimensions
  // and the slope between them. The pitch is the angle of the segment measured
  // left-to-right, because the ground does not care which way you are driving;
  // the mirror is applied inside the rotate, so the vehicle turns round to face
  // its direction and is THEN tilted onto the rock.
  //
  //   data-crawl   "x,y x,y ..." in scene coordinates, read straight off the
  //                silhouette of whatever it is climbing.
  const CRAWL = { dwell: 2.2 };

  function buildCrawls(svg) {
    const out = [];
    svg.querySelectorAll('.cc-crawl').forEach(node => {
      const pts = (node.getAttribute('data-crawl') || '').trim().split(/\s+/)
        .map(q => q.split(',').map(Number)).filter(q => q.length === 2 && !q.some(isNaN));
      if (pts.length < 2) { console.warn('cc-crawl has no usable data-crawl'); return; }
      const segs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
        const len = Math.sqrt(dx * dx + dy * dy);
        segs.push({ x: pts[i - 1][0], y: pts[i - 1][1], dx: dx, dy: dy, len: len,
                    at: total, deg: Math.atan2(dy, dx) * 180 / Math.PI });
        total += len;
      }
      out.push({ el: node, segs: segs, total: total, d: 0, dir: 1, wait: 0,
                 s: parseFloat(node.getAttribute('data-scale')) || 1,
                 nose: parseFloat(node.getAttribute('data-nose')) || 1,
                 speed: parseFloat(node.getAttribute('data-speed')) || 14 });
    });
    return out;
  }

  function updateCrawls(dt) {
    const list = currentScene && currentScene.crawls;
    if (!list || !list.length) return;
    const secs = dt / 1000;
    list.forEach(c => {
      if (c.wait > 0) {
        c.wait -= secs;
      } else {
        c.d += c.speed * c.dir * secs;
        if (c.d >= c.total) { c.d = c.total; c.dir = -1; c.wait = CRAWL.dwell; }
        else if (c.d <= 0) { c.d = 0; c.dir = 1; c.wait = CRAWL.dwell; }
      }
      let seg = c.segs[c.segs.length - 1];
      for (let i = 0; i < c.segs.length; i++) {
        if (c.d <= c.segs[i].at + c.segs[i].len) { seg = c.segs[i]; break; }
      }
      const u = seg.len ? (c.d - seg.at) / seg.len : 0;
      const x = seg.x + seg.dx * u, y = seg.y + seg.dy * u;
      const facing = c.dir > 0 ? 1 : -1;
      const sx = (facing !== c.nose ? -c.s : c.s);
      c.el.setAttribute('transform',
        'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + seg.deg.toFixed(1) +
        ') scale(' + sx + ',' + c.s + ')');
    });
  }

  // =======================================================================
  // The Speedway (.cc-racer + the pit sequence).
  //
  // The pack: six cars, each keeping its OWN lane and scale. They are drawn at
  // three depths (y 394/407/420 at 0.62/0.65/0.68), which is what makes it read
  // as a track rather than a conveyor, so nothing here moves them off their
  // line — only along it, at their own pace, so they overtake.
  //
  // The stop: one car leaves the pack at the pit entry, runs the lane, is jacked
  // up in the box with its wheels off, and goes back out. The lane is 72px
  // FURTHER from the viewer than the racing line, so the car shrinks on the way
  // in and grows on the way out; interpolate the scale with the position or it
  // appears to swell as it drives away.
  // The cars are drawn NOSE-LEFT: the front wing sits at x=-76 and the rear
  // wing and its endplate at x=52..80. Everything here runs them left to right,
  // so they are mirrored — without it the whole field drives backwards, which is
  // exactly how it shipped.
  const RACE = { lo: -140, hi: 1420 };
  const faceX = (s, goingRight) => (goingRight ? -s : s);
  const PIT = {
    entry: 120,       // where it peels off the racing line — BEFORE the boxes
    lane: 0.50,       // scale in the pit lane, against 0.62 on the track
    laneY: 318,       // the lane's centre — 72px further from the viewer than the track
    steps: [          // name, seconds
      ['in',    2.0],   // up the slip road into the lane
      ['along', 1.6],   // along the lane to the box, the way the track runs
      ['jack',  0.5],   // nose lifts
      ['off',   1.1],   // wheels off
      ['on',    1.1],   // wheels on
      ['drop',  0.4],
      ['leave', 3.0],   // on along the lane to the exit
      ['out',   1.8],   // slip road back onto the track
    ],
  };

  function buildRace(svg) {
    const cars = [];
    svg.querySelectorAll('.cc-racer').forEach(node => {
      const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)\s*scale\(\s*([\d.]+)/
        .exec(node.getAttribute('transform') || '');
      // ONLY the six on the straight. .cc-racer is also worn by the ten cars
      // queueing on the grass and by the one in the box — animating those sent
      // the paddock driving off across the infield.
      if (!m || !/cc-racer-\d+$/.test(node.id)) return;
      cars.push({ el: node, x: +m[1], y: +m[2], s: +m[3],
                  wheels: node.querySelector('.cc-racer-wheels'),
                  // A spread of speeds, from the id, so they overtake each other
                  // and the order on the straight keeps changing.
                  speed: 210 + (cars.length % 4) * 26 });
    });
    if (!cars.length) return null;
    const paths = {};
    ['pit-in-path', 'pit-lane-path', 'pit-out-path'].forEach(id => {
      paths[id] = svg.querySelector('[id$="' + id + '"]');
    });
    if (!paths['pit-in-path']) return { cars: cars, pit: null };
    const box = svg.querySelector('[id$="pit-box-stop"]');
    return {
      cars: cars, parked: svg.querySelector('[id$="cc-racer-pit"]'),
      pit: { inP: paths['pit-in-path'], laneP: paths['pit-lane-path'],
             outP: paths['pit-out-path'],
             boxX: box ? parseFloat(box.getAttribute('cx')) : 430,
             car: null, step: 0, t: 0, cooldown: 6 },
    };
  }

  function ptOn(path, u) { return path.getPointAtLength(path.getTotalLength() * u); }

  function updateRace(dt) {
    const r = currentScene && currentScene.race;
    if (!r) return;
    const secs = dt / 1000;
    const pit = r.pit;

    r.cars.forEach(c => {
      if (pit && pit.car === c) return;               // it is in the lane, not the pack
      c.x += c.speed * secs;
      if (c.x > RACE.hi) c.x = RACE.lo;
      c.el.setAttribute('transform',
        'translate(' + c.x.toFixed(1) + ',' + c.y + ') scale(' + faceX(c.s, true) + ',' + c.s + ')');
    });
    if (!pit) return;

    // Nobody in the lane? Wait a while, then take whichever car is nearest the
    // pit entry — so the one that peels off is one you were just watching.
    if (!pit.car) {
      pit.cooldown -= secs;
      if (pit.cooldown > 0) return;
      const near = r.cars.filter(c => c.x > PIT.entry - 60 && c.x < PIT.entry + 60)[0];
      if (!near) return;
      pit.car = near; pit.step = 0; pit.t = 0;
      if (r.parked) r.parked.setAttribute('visibility', 'hidden');   // one car per stall
      return;
    }

    pit.t += secs;
    const step = PIT.steps[pit.step];
    const u = Math.min(1, pit.t / step[1]);
    const c = pit.car;
    let x = c.x, y = c.y, s = c.s, lift = 0;

    if (step[0] === 'in') {
      const p = ptOn(pit.inP, u); x = p.x; y = p.y; s = c.s + (PIT.lane - c.s) * u;
    } else if (step[0] === 'along') {
      // The lane is a straight line, so drive it by x. Fractions of a path that
      // runs off both sides of the frame were only ever arithmetic to get wrong.
      x = 300 + (pit.boxX - 300) * u; y = PIT.laneY; s = PIT.lane;
    } else if (step[0] === 'leave') {
      x = pit.boxX + (1180 - pit.boxX) * u; y = PIT.laneY; s = PIT.lane;
    } else if (step[0] === 'out') {
      const p = ptOn(pit.outP, u); x = p.x; y = p.y; s = PIT.lane + (c.s - PIT.lane) * u;
    } else {
      x = pit.boxX; y = PIT.laneY; s = PIT.lane;
      // jacked up, then held there while the wheels are off
      lift = step[0] === 'jack' ? -5 * u : step[0] === 'drop' ? -5 * (1 - u) : -5;
      if (c.wheels) {
        c.wheels.setAttribute('opacity',
          step[0] === 'off' ? (1 - u).toFixed(2) : step[0] === 'on' ? u.toFixed(2) : '1');
      }
    }
    // The whole stop now runs left to right — in, along, out — so the car never
    // turns round at any point, which is the entire reason for re-authoring the
    // slip roads.
    const goingRight = true;
    c.el.setAttribute('transform',
      'translate(' + x.toFixed(1) + ',' + (y + lift).toFixed(1) + ') scale(' +
      faceX(s, goingRight).toFixed(3) + ',' + s.toFixed(3) + ')');

    if (u >= 1) {
      pit.step++;
      pit.t = 0;
      if (pit.step >= PIT.steps.length) {
        // back on the racing line at the exit, in its own lane again
        c.x = 1370; 
        if (c.wheels) c.wheels.setAttribute('opacity', '1');
        pit.car = null; pit.step = 0; pit.cooldown = 9;
        if (r.parked) r.parked.setAttribute('visibility', 'visible');
      }
    }
  }

  // =======================================================================
  // Sun Valley: the mountain works.
  //
  // The art carries the contract on IDS rather than classes here — the handoff
  // documents it that way and every cabin, chair and skier already ships with
  // data-t and data-s — so these are found by id substring. Ids are namespaced
  // per scene by inline-assets.py, hence [id*=] rather than [id=].
  //
  // A LIFT IS A LOOP, NOT A LINE. Each has two ropes side by side: cabins climb
  // the far one and come back down the near one. Drive them in opposite
  // directions or the whole thing reads as a one-way conveyor.
  //
  // Everything shrinks as it climbs. The drawn scales confirm the rule exactly —
  // gondola-up-0 sits at t=0.081 and was authored at 0.91, and 0.95 - 0.5t gives
  // 0.910 — so a cabin that keeps its size looks like it is sliding along a wire
  // drawn on the sky instead of going up a mountain.
  const LIFT = { near: 0.95, far: 0.5 };

  function buildLifts(svg) {
    const out = [];
    [['cc-gondola-', 'gondola-path-', 30], ['cc-chair-', 'chair-path-', 22]].forEach(([car, path, secs]) => {
      ['up', 'down'].forEach(dir => {
        const rope = svg.querySelector('[id*="' + path + dir + '"]');
        if (!rope) return;
        const cars = [].map.call(svg.querySelectorAll('[id*="' + car + dir + '-"]'), el => ({
          el: el, t0: parseFloat(el.getAttribute('data-t')) || 0,
        }));
        if (cars.length) out.push({ rope: rope, len: rope.getTotalLength(), cars: cars,
                                    secs: secs, sign: dir === 'up' ? 1 : -1 });
      });
    });
    return out.length ? out : null;
  }

  function updateLifts(t) {
    const list = currentScene && currentScene.lifts;
    if (!list) return;
    const secs = t / 1000;
    list.forEach(L => {
      L.cars.forEach(c => {
        let u = (c.t0 + L.sign * secs / L.secs) % 1;
        if (u < 0) u += 1;
        const p = L.rope.getPointAtLength(L.len * u);
        c.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
          ') scale(' + (LIFT.near - LIFT.far * u).toFixed(3) + ')');
      });
    });
  }

  // The skiers. Each run is drawn as a path that wanders inside its corridor, so
  // one walked along it comes down in a line of TURNS rather than straight down
  // the fall line — which is the whole reason the runs are paths and not lines.
  // They grow as they descend, because the bottom of a run is nearer.
  const SKI = { near: 0.34, grow: 0.34, secs: 15, lean: 22 };

  function buildSkiers(svg) {
    const runs = {};
    const out = [];
    svg.querySelectorAll('.cc-skier').forEach(el => {
      const n = el.getAttribute('data-run');
      if (!runs[n]) {
        const path = svg.querySelector('[id*="run-path-' + n + '"]');
        if (!path) return;
        runs[n] = { path: path, len: path.getTotalLength() };
      }
      out.push({ el: el, run: runs[n], t: parseFloat(el.getAttribute('data-t')) || 0,
                 // a spread of paces, so a run is not a conveyor of identical skiers
                 speed: 1 / (SKI.secs * (0.8 + (out.length % 5) * 0.11)) });
    });
    return out.length ? out : null;
  }

  function updateSkiers(dt) {
    const list = currentScene && currentScene.skiers;
    if (!list) return;
    const secs = dt / 1000;
    list.forEach(s => {
      s.t += s.speed * secs;
      if (s.t > 1) s.t -= 1;                       // back to the top of the same run
      const L = s.run.len;
      const p = s.run.path.getPointAtLength(L * s.t);
      // Lean into the turn: the heading is mostly downward, so the angle off
      // vertical is what tells you which way they are cutting across the fall line.
      const a = s.run.path.getPointAtLength(Math.min(L, L * s.t + 6));
      const lean = Math.max(-SKI.lean, Math.min(SKI.lean,
        Math.atan2(a.x - p.x, Math.max(0.001, a.y - p.y)) * 180 / Math.PI));
      s.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
        ') scale(' + (SKI.near + SKI.grow * s.t).toFixed(3) + ') rotate(' + (-lean).toFixed(1) + ')');
    });
  }

  // The ploughs. #cc-plough clears the verge on a path that STOPS at the
  // carriageway, so a pass can never drive across the road or the crossing;
  // #cc-plough-far works the town street. Both are drawn facing left.
  const PLOUGH = { secs: 22, dwell: 1.6 };

  function buildPloughs(svg) {
    const out = [];
    [['cc-plough', 'plough-path'], ['cc-plough-far', 'street-path']].forEach(([id, pid]) => {
      const el = svg.querySelector('[id$="' + id + '"]');
      const path = svg.querySelector('[id*="' + pid + '"]');
      if (!el || !path) return;
      const m = /scale\(\s*([\d.]+)/.exec(el.getAttribute('transform') || '');
      out.push({ el: el, path: path, len: path.getTotalLength(),
                 s: m ? +m[1] : 1, t: 0, dir: 1, wait: 0 });
    });
    return out.length ? out : null;
  }

  function updatePloughs(dt) {
    const list = currentScene && currentScene.ploughs;
    if (!list) return;
    const secs = dt / 1000;
    list.forEach(q => {
      if (q.wait > 0) { q.wait -= secs; }
      else {
        q.t += q.dir * secs / PLOUGH.secs;
        if (q.t >= 1) { q.t = 1; q.dir = -1; q.wait = PLOUGH.dwell; }
        else if (q.t <= 0) { q.t = 0; q.dir = 1; q.wait = PLOUGH.dwell; }
      }
      const p = q.path.getPointAtLength(q.len * q.t);
      // Drawn facing LEFT, so it is mirrored on the outward pass.
      const sx = q.dir > 0 ? -q.s : q.s;
      q.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
        ') scale(' + sx + ',' + q.s + ')');
    });
  }

  // =======================================================================
  // Idling animals (.cc-idle).
  //
  // ANIMATE ONE OF A GROUP AND THE REST LOOK BROKEN. Nine still horses in a
  // paddock read as a painting; one cantering past eight frozen ones reads as
  // eight things that are stuck. The first person to notice was a three-year-old,
  // about two seconds after the cantering one shipped.
  //
  // So every animal grazes and swishes, whether or not it is going anywhere.
  // This touches only `.cc-head` and `.cc-tail` INSIDE the animal, never its
  // root, so it composes with the canter — that controller drives the root and
  // the legs and neither knows about the other.
  //
  //   .cc-idle          the animal, with data-i for a stable phase
  //   .cc-head          data-pivot="x,y" at the WITHERS, not the poll
  //   .cc-tail          data-pivot="x,y" at the croup
  // 2.6 degrees was invisible and it is worth understanding why: the swing is an
  // ANGLE, so what you see is the angle times the distance from the pivot times
  // the animal's scale. A grazing horse's muzzle is ~100 local units from its
  // withers, and at scale 0.24 that is 100 x sin(2.6deg) x 0.24 = well under a
  // pixel. Eight degrees on the same horse is about 3px, and on the foreground
  // mare at 0.56 it is 8px — which reads.
  //
  // A head down in the grass and a head up looking about are different motions:
  // the first is a long slow sweep as it crops along, the second a quicker,
  // smaller turn. The art says which with data-graze.
  const IDLE = {
    graze: 8, grazeSecs: 6.0,     // head down: a long crop
    look: 5, lookSecs: 3.4,       // head up: a glance about
    tail: 9, tailSecs: 5.5,
  };

  function buildIdles(svg) {
    const out = [];
    svg.querySelectorAll('.cc-idle').forEach(node => {
      const i = parseFloat(node.getAttribute('data-i')) || 0;
      const part = (sel) => {
        const el = node.querySelector(sel);
        if (!el) return null;
        const p = (el.getAttribute('data-pivot') || '').split(',').map(Number);
        return (p.length === 2 && !p.some(isNaN)) ? { el: el, px: p[0], py: p[1] } : null;
      };
      const head = part('.cc-head'), tail = part('.cc-tail');
      if (!head && !tail) return;
      const grazing = !!(head && head.el.getAttribute('data-graze'));
      out.push({
        head: head, tail: tail,
        hAmp: grazing ? IDLE.graze : IDLE.look,
        // Periods and phases both come from data-i, so no two fall into step and
        // the paddock looks the same every run without needing a seeded random.
        hSecs: (grazing ? IDLE.grazeSecs : IDLE.lookSecs) + (i % 7) * 0.6,
        hPhase: (i % 11) / 11,
        tSecs: IDLE.tailSecs + (i % 5) * 0.9, tPhase: (i % 13) / 13,
        tDir: (i % 2) ? 1 : -1,
      });
    });
    return out;
  }

  function updateIdles(t) {
    const list = currentScene && currentScene.idles;
    if (!list || !list.length) return;
    const secs = t / 1000;
    list.forEach(o => {
      if (o.head) {
        const a = o.hAmp * Math.sin((secs / o.hSecs + o.hPhase) * TAU);
        o.head.el.setAttribute('transform',
          'rotate(' + a.toFixed(2) + ',' + o.head.px + ',' + o.head.py + ')');
      }
      if (o.tail) {
        // A tail is still most of the time and then flicks. A sine would wag it
        // like a metronome, which is a dog, not a horse.
        const u = (secs / o.tSecs + o.tPhase) % 1;
        const k = u < 0.16 ? Math.sin(u / 0.16 * Math.PI) : 0;
        const a = IDLE.tail * k * o.tDir;
        o.tail.el.setAttribute('transform',
          'rotate(' + a.toFixed(2) + ',' + o.tail.px + ',' + o.tail.py + ')');
      }
    });
  }

  // =======================================================================
  // Drifters (.cc-drift) — the one that covers most of Wave 7.
  //
  // Follow a drawn path at a steady speed and WRAP at the end. That is a tow on
  // the Mississippi, a freight on a bridge, rafts in a rapid, sails on a bay and
  // traffic on two highway bridges — seven groups of things across four scenes,
  // all of which are "go along that line and come round again".
  //
  // It differs from a shuttle in the two ways that matter here: it wraps instead
  // of turning round, and it follows a real <path>, so a deck with a bend in it
  // (Newport's Pell Bridge) works without special-casing.
  //
  //   data-path    the path's id (matched on the END, since ids are namespaced)
  //   data-t       where on it to start, 0..1 — also the animation's phase, so
  //                everything is stable across runs without a seeded random
  //   data-speed   px/s along the path; NEGATIVE runs it backwards
  //   data-scale   the size the art was drawn at, since the transform is rewritten
  //   data-nose    +1 if the art faces right, -1 if left
  //   data-bob     "amplitude,seconds" — a raft in a rapid, a boat on a swell
  //   data-turn    present: rotate to the path's heading (a bridge that bends)
  function buildDrifts(svg) {
    const out = [];
    svg.querySelectorAll('.cc-drift').forEach(node => {
      const pid = node.getAttribute('data-path') || '';
      const path = pid && svg.querySelector('[id$="' + pid + '"]');
      if (!path || !path.getTotalLength) { console.warn('cc-drift has no path: ' + pid); return; }
      const len = path.getTotalLength();
      if (!len) { console.warn('cc-drift path has no length: ' + pid); return; }
      const bob = (node.getAttribute('data-bob') || '').split(',').map(Number);
      const hasBob = bob.length === 2 && !bob.some(isNaN);
      out.push({
        el: node, path: path, len: len,
        t: parseFloat(node.getAttribute('data-t')) || 0,
        speed: parseFloat(node.getAttribute('data-speed')) || 40,
        s: parseFloat(node.getAttribute('data-scale')) || 1,
        nose: parseFloat(node.getAttribute('data-nose')) || 1,
        bobA: hasBob ? bob[0] : 0, bobS: hasBob ? bob[1] : 1,
        turn: node.hasAttribute('data-turn'),
      });
    });
    return out;
  }

  function updateDrifts(t, dt) {
    const list = currentScene && currentScene.drifts;
    if (!list || !list.length) return;
    const secs = t / 1000;
    list.forEach(d => {
      d.t += d.speed * (dt / 1000) / d.len;
      d.t -= Math.floor(d.t);                       // wrap, either direction
      const at = d.t * d.len;
      const p = d.path.getPointAtLength(at);
      const y = p.y + (d.bobA ? d.bobA * Math.sin((secs / d.bobS + d.t) * TAU) : 0);
      let tr = 'translate(' + p.x.toFixed(1) + ',' + y.toFixed(1) + ')';
      if (d.turn) {
        const a = d.path.getPointAtLength(Math.max(0, at - 5));
        const b = d.path.getPointAtLength(Math.min(d.len, at + 5));
        tr += ' rotate(' + (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toFixed(2) + ')';
      }
      const facing = d.speed > 0 ? 1 : -1;
      const sx = (facing !== d.nose ? -d.s : d.s);
      tr += ' scale(' + sx + ',' + d.s + ')';
      d.el.setAttribute('transform', tr);
    });
  }

  // =======================================================================
  // Flags (.cc-flag) — Mount Rushmore's avenue of banners.
  //
  // A flag does two things at once and needs both, or it reads as a card on a
  // stick: it SWINGS about the halyard, and it FURLS — the free edge collapses
  // toward the pole and fills again as the gust passes. Rotation alone is a
  // pendulum; the narrowing is what makes it cloth.
  //
  // Phases run along the avenue rather than at random, so a gust travels down
  // the line from one end to the other. That is worth more than twelve flags
  // each doing their own thing, and it costs the same.
  //
  //   .cc-flag with data-pivot="x,y" at the halyard and data-i for the phase
  const FLAG = { swing: 5, furl: 0.22, secs: 1.5, gust: 0.11 };

  // =======================================================================
  // A JET (.cc-jet) — water thrown UP, which is the one thing a fountain does
  // that a waterfall does not.
  //
  //   data-pivot="x,y"   the nozzle. The plume scales about it, so it grows out
  //                      of the pipe rather than inflating around its own middle
  //                      — the same rule the geyser column follows.
  //   data-i             its place in the group, so no two jets pulse together.
  //                      A fountain whose jets breathe in step is one jet.
  //
  // Height only. A jet that changed width too read as a puff of steam.
  // =======================================================================
  const JET = { lo: 0.84, hi: 1.1, secs: 2.3, stagger: 0.37 };

  function buildJets(svg) {
    const out = [];
    svg.querySelectorAll('.cc-jet').forEach(node => {
      const p = (node.getAttribute('data-pivot') || '').split(',').map(Number);
      if (p.length !== 2 || p.some(isNaN)) { console.warn('cc-jet has no usable data-pivot'); return; }
      out.push({ el: node, px: p[0], py: p[1],
                 phase: (parseFloat(node.getAttribute('data-i')) || 0) * JET.stagger });
    });
    return out;
  }

  function updateJets(t) {
    const list = currentScene && currentScene.jets;
    if (!list || !list.length) return;
    const secs = t / 1000;
    list.forEach(j => {
      const u = 0.5 + 0.5 * Math.sin((secs / JET.secs + j.phase) * TAU);
      const k = JET.lo + (JET.hi - JET.lo) * u;
      j.el.setAttribute('transform',
        'translate(' + j.px + ',' + j.py + ') scale(1,' + k.toFixed(3) + ') '
        + 'translate(' + (-j.px) + ',' + (-j.py) + ')');
    });
  }

  // =======================================================================
  // WATCHERS (.cc-watch) — people at a lineside overlook, pointing at the train.
  //
  // Horseshoe Curve is a place people GO TO WATCH TRAINS, so the one thing its
  // figures should do is notice one. Turning them to face it is no use: they are
  // drawn front-on and symmetric, so a mirror changes nothing on screen. An ARM
  // does — a raised arm is a silhouette change, and it reads at ten pixels where
  // a turned head does not.
  //
  //   .cc-watch          the figure
  //     .cc-point        an arm, with data-pivot="x,y" at the SHOULDER and
  //                      data-side="-1|1" for which side of the body it is on.
  //                      Only the arm on the train's side goes up, so nobody
  //                      points across their own chest.
  //
  // It follows whichever train there is — the child's when one is running,
  // otherwise the one going round the bowl — and the arms come down when it is
  // too far off to be worth pointing at, which is what makes the raising read as
  // a reaction rather than a pose.
  // =======================================================================
  // PAST HORIZONTAL. An arm hangs at 0 and horizontal is 90, so anything less
  // than that is a shrug — the first try used 58 and the watchers stood with
  // their elbows out. 108 puts the hand above the shoulder, pointing up at a
  // train that is always higher up the hillside than they are.
  const WATCH = { reach: 460, lift: 108, secs: 0.45 };

  function buildWatchers(svg) {
    const out = [];
    svg.querySelectorAll('.cc-watch').forEach(node => {
      const m = /translate\(\s*(-?[\d.]+)/.exec(node.getAttribute('transform') || '');
      const arms = [].map.call(node.querySelectorAll('.cc-point'), el => {
        const p = (el.getAttribute('data-pivot') || '0,0').split(',').map(Number);
        return { el: el, px: p[0] || 0, py: p[1] || 0,
                 side: parseFloat(el.getAttribute('data-side')) || 1, a: 0 };
      });
      if (arms.length) out.push({ x: m ? +m[1] : 0, arms: arms });
    });
    return out;
  }

  /** Where the nearest train is, in scene x, or null if there is none to see. */
  function watchTarget() {
    if (train.active) return train.head;
    const c = currentScene && currentScene.curve;
    if (c && c.path) {
      try { return c.path.getPointAtLength(clamp(c.dist, 0, c.exitAt)).x; } catch (e) { return null; }
    }
    return null;
  }

  function updateWatchers(dt) {
    const list = currentScene && currentScene.watchers;
    if (!list || !list.length) return;
    const tx = watchTarget();
    const step = WATCH.lift * (dt / 1000) / WATCH.secs;
    list.forEach(w => {
      const dx = tx == null ? null : tx - w.x;
      const near = dx != null && Math.abs(dx) < WATCH.reach;
      w.arms.forEach(arm => {
        // Up only if the train is on THIS arm's side of the body.
        // NEGATIVE side, because SVG rotates clockwise: a hanging arm swung by
        // +108 goes out to the LEFT and by -108 to the right. Getting this
        // backwards folds both arms across the chest, where they vanish behind
        // the torso and read as a shrug.
        const want = (near && (dx > 0 ? 1 : -1) === arm.side) ? -arm.side * WATCH.lift : 0;
        arm.a += clamp(want - arm.a, -step, step);
        arm.el.setAttribute('transform',
          'rotate(' + arm.a.toFixed(1) + ',' + arm.px + ',' + arm.py + ')');
      });
    });
  }

  // =======================================================================
  // PUMPJACKS (.cc-pumpjack) — the set's first coupled linkage. Everything else
  // that moves either travels along a path or turns as one rigid piece; this is
  // three rotations that have to agree with each other, and a wrong one looks
  // broken in a way a wrong tree does not.
  //
  //   .cc-pj-crank    turns CONTINUOUSLY about the gearbox shaft
  //   .cc-pj-beam     rocks about the saddle on top of the A-frame
  //     .cc-pj-pitman NESTED in the beam, hanging off its rear pin
  //
  // EVERY PIVOT IS ITS OWN GROUP'S ORIGIN, which the art did on purpose — so
  // animating is only ever rewriting the rotate() and never touching the
  // translate. Read each authored translate once and put it back every frame.
  //
  // beam = A·sin(theta) and pitman = -0.55·beam is an approximation, not a solved
  // four-bar, and that is the right call: the exact answer moves the crank pin two
  // or three pixels and costs a square root per machine per frame.
  //
  // SLOW, and NOT IN STEP. A real one runs six to twelve strokes a minute, and
  // these are separately owned wells that would never be synchronised — three
  // machines nodding together read as one machine copied three times, which is
  // exactly what they are.
  // =======================================================================
  //
  // THE SIGN ON THE BEAM IS NOT ARBITRARY. In the art the counterweight sits at
  // the crank's local -x and the crank pin at +x, so the weight is HIGHEST when
  // the crank is at 90 degrees. Drive the beam with +A·sin and the horsehead is
  // also up at 90 — weight and head rising together, which is what a real one
  // must never do. The counterweight exists to fall while the head lifts the rod
  // string, so it is HIGH when the head is DOWN and the rods are at the bottom of
  // the stroke, about to be pulled up. Hence the minus.
  const PUMP = { swing: -9, pitman: -0.55, secs: 4.6, spread: 0.9 };

  function buildPumpjacks(svg) {
    const out = [];
    const at = (el) => {
      const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(el.getAttribute('transform') || '');
      return m ? 'translate(' + m[1] + ',' + m[2] + ') ' : '';
    };
    svg.querySelectorAll('.cc-pumpjack').forEach((node, i) => {
      const crank = node.querySelector('.cc-pj-crank');
      const beam = node.querySelector('.cc-pj-beam');
      const pitman = node.querySelector('.cc-pj-pitman');
      if (!crank || !beam) { console.warn('cc-pumpjack is missing its crank or beam'); return; }
      // Each well its own rate, and its own starting angle taken from the pose
      // the art drew it in rather than from a counter.
      const a0 = /rotate\(\s*(-?[\d.]+)/.exec(crank.getAttribute('transform') || '');
      out.push({
        crank: crank, beam: beam, pitman: pitman,
        ct: at(crank), bt: at(beam), pt: pitman ? at(pitman) : '',
        secs: PUMP.secs * (1 + (i % 3) * 0.17),
        phase: (a0 ? +a0[1] : i * 90) / 360,
      });
    });
    return out;
  }

  function updatePumpjacks(t) {
    const list = currentScene && currentScene.pumpjacks;
    if (!list || !list.length) return;
    const secs = t / 1000;
    list.forEach(p => {
      const th = (secs / p.secs + p.phase) * TAU;
      const beam = PUMP.swing * Math.sin(th);
      p.crank.setAttribute('transform', p.ct + 'rotate(' + (th * 180 / Math.PI % 360).toFixed(1) + ')');
      p.beam.setAttribute('transform', p.bt + 'rotate(' + beam.toFixed(2) + ')');
      if (p.pitman) {
        p.pitman.setAttribute('transform',
          p.pt + 'rotate(' + (PUMP.pitman * beam).toFixed(2) + ')');
      }
    });
  }

  // =======================================================================
  // A DUST DEVIL (.cc-dustdevil) — wanders across the field on #dust-path.
  //
  // Not a tornado, and that is not an oversight: Moore is a suburb of this city.
  // Do not "upgrade" it.
  //
  // Slow enough to be scenery rather than an event — half a minute to cross —
  // with a small sway about its FOOT, which is where the group's origin is. It
  // fades up at one end and away at the other, because a dust devil forms and
  // collapses rather than walking on from off stage, and it takes the depth
  // scale so drifting toward the city shrinks it.
  // =======================================================================
  const DEVIL = { secs: 34, sway: 2.6, swaySecs: 5.3, fade: 0.14 };

  function buildDustDevil(svg) {
    const el = svg.querySelector('.cc-dustdevil');
    const path = svg.querySelector('[id$="dust-path"]');
    if (!el || !path || !path.getTotalLength) return null;
    let total = 0;
    try { total = path.getTotalLength(); } catch (e) { return null; }
    if (!total) return null;
    // WHERE IT TOUCHES THE GROUND, from the art. This group has no transform at
    // all — its geometry is authored in absolute scene coordinates — so a bare
    // translate ADDS to coordinates that already place it, and the column sails
    // off the right of the frame. The handoff said the origin was at the foot; it
    // is not, and data-foot is how the art says so instead.
    const f = (el.getAttribute('data-foot') || '').split(',').map(Number);
    if (f.length !== 2 || f.some(isNaN)) { console.warn('cc-dustdevil has no data-foot'); return null; }
    return { el: el, path: path, total: total, t: 0.42,
             fx: f[0], fy: f[1], base: depthScale(f[1]) };
  }

  function updateDustDevil(dt, t) {
    const d = currentScene && currentScene.devil;
    if (!d) return;
    d.t += (dt / 1000) / DEVIL.secs;
    if (d.t >= 1) d.t -= 1;
    const p = d.path.getPointAtLength(d.total * d.t);
    const sway = DEVIL.sway * Math.sin((t / 1000 / DEVIL.swaySecs) * TAU);
    // Depth, off the same rule as everything else, normalised so it is drawn at
    // the size the art chose when it is where the art put it.
    const k = depthScale(p.y) / d.base;
    const fade = Math.min(1, d.t / DEVIL.fade, (1 - d.t) / DEVIL.fade);
    d.el.setAttribute('opacity', Math.max(0, fade).toFixed(3));
    // Rotate and scale about the FOOT, then put the foot where the path says.
    d.el.setAttribute('transform',
      'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') rotate('
      + sway.toFixed(2) + ') scale(' + k.toFixed(3) + ') translate('
      + (-d.fx) + ',' + (-d.fy) + ')');
  }

  // =======================================================================
  // WISCONSIN DELLS — the water park. Three separate things, one shared idea:
  // sample a drawn path, and let the ART decide the shape of the motion.
  //
  // A tiny helper first, because all three want the same thing.
  // =======================================================================
  function pathOf(svg, name) {
    const el = svg.querySelector('[id$="' + name + '"]');
    if (!el || !el.getTotalLength) return null;
    let total = 0;
    try { total = el.getTotalLength(); } catch (e) { return null; }
    return total ? { el: el, total: total } : null;
  }

  function pointAt(p, u) {
    const d = clamp(u, 0, 1) * p.total;
    const a = p.el.getPointAtLength(Math.max(0, d - 2));
    const b = p.el.getPointAtLength(Math.min(p.total, d + 2));
    const here = p.el.getPointAtLength(d);
    return { x: here.x, y: here.y, vx: b.x - a.x, vy: b.y - a.y };
  }

  // ---- THE SLIDE (.cc-slider on #slide-path, .cc-splash at the bottom) ----
  //
  // THE SPEED IS THE POINT. A rider at constant speed down this path is a
  // sticker being dragged along a line; what makes it a slide is accelerating
  // into the drop and running out of steam along the flat. So the profile is
  // written as a velocity curve over the path rather than as an easing of
  // position — it says what it means, and the peak sits at the DROP (about a
  // third of the way down) rather than at the middle, which is where a plain
  // smoothstep would have put it.
  //
  // Each rider group is a bare translate with the pose on an inner group; the
  // art did that so rotation and scale never fight the position. Scale comes off
  // depthScale, normalised at the authored point, so a rider grows as it comes
  // toward the viewer without anybody choosing numbers.
  const SLIDE = { secs: 2.1, gap: 0.55, hold: 0.9, base: 596 };
  // A PUNCH NEEDS SOMEWHERE TO PUNCH FROM. The splash is authored always-on so the
  // static render looks right, but resting it at 0.72 left the burst nowhere to go
  // — it read as a permanent white smudge that got slightly brighter, which is to
  // say as no splash at all. It rests small and faint and lands hard instead.
  const SPLASH = { rest: 0.28, restK: 0.84, up: 0.11, down: 0.62, kick: 0.72 };

  function slideSpeed(u) {
    if (u < 0.14) return 0.4 + 0.6 * (u / 0.14);      // push off, pick up
    if (u < 0.48) return 1;                            // the drop
    return 1 - 0.78 * ((u - 0.48) / 0.52);             // the runout
  }

  function buildSlide(svg) {
    const path = pathOf(svg, 'slide-path');
    const riders = svg.querySelectorAll('.cc-slider');
    if (!path || !riders.length) return null;
    const splashEl = svg.querySelector('.cc-splash');
    let splash = null;
    if (splashEl) {
      const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(splashEl.getAttribute('transform') || '');
      splash = { el: splashEl, x: m ? +m[1] : 398, y: m ? +m[2] : 662, t: 99 };
      splashEl.setAttribute('opacity', SPLASH.rest.toFixed(2));
    }
    return {
      path: path, splash: splash,
      riders: [].map.call(riders, (el, i) => ({
        el: el, inner: el.firstElementChild,
        // Staggered, so one is on the drop while the next is still at the top.
        u: -i * SLIDE.gap, wait: 0,
      })),
    };
  }

  function updateSlide(dt) {
    const s = currentScene && currentScene.slide;
    if (!s) return;
    const secs = dt / 1000;
    const k0 = depthScale(SLIDE.base);
    s.riders.forEach(r => {
      if (r.wait > 0) { r.wait -= secs; return; }
      r.u += slideSpeed(Math.max(0, r.u)) * secs / SLIDE.secs;
      if (r.u >= 1) {                       // into the pool, and back to the steps
        r.u = 0; r.wait = SLIDE.hold;
        if (s.splash) s.splash.t = 0;
      }
      const at = pointAt(s.path, Math.max(0, r.u));
      const k = depthScale(at.y) / k0;
      r.el.setAttribute('transform', 'translate(' + at.x.toFixed(1) + ',' + at.y.toFixed(1) + ')');
      if (r.inner) {
        r.inner.setAttribute('transform',
          'rotate(' + (Math.atan2(at.vy, at.vx) * 180 / Math.PI).toFixed(1)
          + ') scale(' + k.toFixed(3) + ')');
      }
      r.el.setAttribute('opacity', r.u < 0 ? '0' : '1');
    });
    // THE PUNCH. Up hard, back down slowly — 120ms out and half a second back,
    // which is the difference between a splash and a pulsing blob.
    if (s.splash) {
      const p = s.splash;
      p.t += secs;
      const up = clamp(p.t / SPLASH.up, 0, 1);
      const down = ease(clamp((p.t - SPLASH.up) / SPLASH.down, 0, 1));
      const hit = up - up * down;                      // 0 at rest, 1 at the peak
      const k = SPLASH.restK + SPLASH.kick * hit;
      p.el.setAttribute('opacity', (SPLASH.rest + (1 - SPLASH.rest) * hit).toFixed(3));
      // JUST translate-then-scale. The group's geometry is authored around its OWN
      // origin, so scaling about it is one scale after the translate — the
      // scale-about-an-arbitrary-point sandwich belongs to groups drawn in absolute
      // coordinates, and applied here it threw the splash to x=-315, y=-464 and off
      // the frame. Which is why there appeared to be no splash at all.
      p.el.setAttribute('transform',
        'translate(' + p.x + ',' + p.y + ') scale(' + k.toFixed(3) + ')');
    }
  }

  // ---- THE ENCLOSED TUBE (.cc-tube-rider on #tube-path) ----
  //
  // The small one, and a different IDEA from the open flume rather than a second
  // helping of it: a dark shape seen THROUGH the plastic. The art sandwiched it
  // between the tube's body and its highlight, so translating it is all that is
  // needed for it to look enclosed. Faster than the open slide, on its own clock,
  // and faded at both ends because a rider that pops into existence at the top of
  // a tube is a rider nobody believes is inside it.
  // A 2.6s gap left the tube empty for two thirds of the time, which reads as a
  // ride nobody is using. 1.4 keeps somebody in it more often than not.
  const TUBE = { secs: 1.5, gap: 1.4, fade: 0.12 };

  function buildTube(svg) {
    const path = pathOf(svg, 'tube-path');
    const el = svg.querySelector('.cc-tube-rider');
    return (path && el) ? { path: path, el: el, t: 0 } : null;
  }

  function updateTube(dt) {
    const t = currentScene && currentScene.tube;
    if (!t) return;
    t.t += dt / 1000;
    const span = TUBE.secs + TUBE.gap;
    const u = (t.t % span) / TUBE.secs;
    if (u > 1) { t.el.setAttribute('opacity', '0'); return; }
    const at = pointAt(t.path, u);
    t.el.setAttribute('transform', 'translate(' + at.x.toFixed(1) + ',' + at.y.toFixed(1) + ')');
    t.el.setAttribute('opacity',
      Math.min(1, u / TUBE.fade, (1 - u) / TUBE.fade).toFixed(2));
  }

  // ---- THE DUCK BOAT (.cc-duck on #duck-path) ----
  //
  // The Dells' amphibious tours drive down a ramp and keep going straight into
  // the river. Three nested groups and each is ONE value: the root translates,
  // .cc-duck-tilt pitches, .cc-duck-flip carries the heading.
  //
  // THE HEADING IS THE NEW IDEA. The boat is drawn in profile with its prow to
  // the left, so it can only face two ways — and it turns round by easing
  // scale(sx,1) from +1 THROUGH ZERO to -1. Passing through zero foreshortens the
  // hull to nothing and brings it back the other way, which is what a boat
  // swinging beam-on to the camera actually looks like. Eased, not linear:
  // linear through zero is a card flip.
  //
  // SLOWLY. Twenty seconds end to end, the turn the slowest part of it. The charm
  // is entirely in how unhurried a heavy thing entering water is.
  //
  // The waterline needs no code at all: the near half of the river is painted
  // OVER the boat, so a duck translated along the path submerges for free.
  const DUCK = { secs: 20, hold: 4, tilt: -15, bob: 1.5, bobSecs: 3.4 };

  function buildDuck(svg) {
    const path = pathOf(svg, 'duck-path');
    const el = svg.querySelector('.cc-duck');
    if (!path || !el) return null;
    const tilt = el.querySelector('.cc-duck-tilt');
    const flip = el.querySelector('.cc-duck-flip');
    const bow = el.querySelector('.cc-duck-bow');
    if (bow) bow.setAttribute('opacity', '0');
    // THE WATERLINE, declared by the art. #duck-path is the boat's track in plan
    // and it dives to y=722, where the painted surface is at 617 — following it
    // literally submerges the boat by a hundred pixels and it comes up the far
    // side like a submarine. Afloat, the boat takes its x from the path and its y
    // from the SURFACE.
    const w = (el.getAttribute('data-water') || '').split(',').map(Number);
    const water = (w.length === 4 && !w.some(isNaN))
      ? { x0: w[0], y0: w[1], x1: w[2], y1: w[3] } : null;
    if (!water) console.warn('cc-duck has no data-water; it will follow the path under the surface');
    return { path: path, el: el, tilt: tilt, flip: flip, bow: bow, t: 0,
             water: water, ride: parseFloat(el.getAttribute('data-ride')) || 10 };
  }

  function updateDuck(dt, now) {
    const d = currentScene && currentScene.duck;
    if (!d) return;
    d.t += dt / 1000;
    const span = DUCK.secs + DUCK.hold;
    if (d.t > span) d.t -= span;
    const u = clamp(d.t / DUCK.secs, 0, 1);
    const at = pointAt(d.path, u);
    // The run, as fractions of the path — the handoff's own table.
    const wet = clamp((u - 0.30) / 0.12, 0, 1);          // crossing the waterline
    let y = at.y;
    if (d.water) {
      const t = (at.x - d.water.x0) / (d.water.x1 - d.water.x0);
      const surface = d.water.y0 + (d.water.y1 - d.water.y0) * t;
      // On the concrete it is on the ramp and the path is right; afloat it rides
      // the surface; across the waterline it eases from one to the other, which is
      // the boat settling as it takes the water.
      y = at.y + (surface - d.ride - at.y) * ease(wet);
    }
    d.el.setAttribute('transform', 'translate(' + at.x.toFixed(1) + ',' + y.toFixed(1) + ')');
    const turn = ease(clamp((u - 0.42) / 0.18, 0, 1));   // the swing round
    if (d.tilt) {
      const bob = u > 0.6 ? DUCK.bob * Math.sin(now / 1000 / DUCK.bobSecs * TAU) : 0;
      d.tilt.setAttribute('transform',
        'rotate(' + (DUCK.tilt * (1 - wet) + bob).toFixed(2) + ')');
    }
    if (d.flip) {
      const sx = 1 - 2 * turn;
      // Never exactly zero: a zero scale collapses the group's own bounding box
      // and some engines stop rendering it altogether on the way through.
      d.flip.setAttribute('transform',
        'scale(' + (Math.abs(sx) < 0.02 ? (sx < 0 ? -0.02 : 0.02) : sx).toFixed(3) + ',1)');
    }
    if (d.bow) d.bow.setAttribute('opacity', (0.5 * wet).toFixed(2));
  }

  // =======================================================================
  // A KITE (.cc-kite) — the first thing in the set that hangs off something
  // else and has to drag its line with it.
  //
  //   data-anchor="x,y"   the HAND holding the string
  //   data-home="x,y"     where the art drew it, which is the middle of the swing
  //
  // It swings about the hand at a roughly constant line length, with the length
  // itself breathing a little — a kite rises as it catches and sags as it spills.
  // The string is redrawn from the hand to wherever the kite has got to, keeping
  // the belly the art drew into it, and the kite tips only PART of the way toward
  // the line: fully aligned it lies over on its side, which is a kite that has
  // stopped flying.
  // =======================================================================
  const KITE = { sway: 13, secs: 6.4, bob: 11, bobSecs: 3.7, tip: 0.42, belly: 26 };

  function buildKites(svg) {
    const out = [];
    svg.querySelectorAll('.cc-kite').forEach(node => {
      const a = (node.getAttribute('data-anchor') || '').split(',').map(Number);
      const h = (node.getAttribute('data-home') || '').split(',').map(Number);
      if (a.length !== 2 || h.length !== 2 || a.concat(h).some(isNaN)) {
        console.warn('cc-kite needs data-anchor and data-home'); return;
      }
      // The string is whichever one names the same hand.
      let line = null;
      svg.querySelectorAll('.cc-kite-string').forEach(p => {
        const b = (p.getAttribute('data-anchor') || '').split(',').map(Number);
        if (b.length === 2 && b[0] === a[0] && b[1] === a[1]) line = p;
      });
      const vx = h[0] - a[0], vy = h[1] - a[1];
      out.push({ el: node, line: line, ax: a[0], ay: a[1], vx: vx, vy: vy,
                 len: Math.sqrt(vx * vx + vy * vy) });
    });
    return out;
  }

  function updateKites(t) {
    const list = currentScene && currentScene.kites;
    if (!list || !list.length) return;
    const secs = t / 1000;
    list.forEach(k => {
      const a = KITE.sway * Math.sin(secs / KITE.secs * TAU) * Math.PI / 180;
      const grow = 1 + (KITE.bob * Math.sin(secs / KITE.bobSecs * TAU)) / k.len;
      const c = Math.cos(a), sn = Math.sin(a);
      const x = k.ax + (k.vx * c - k.vy * sn) * grow;
      const y = k.ay + (k.vx * sn + k.vy * c) * grow;
      k.el.setAttribute('transform',
        'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate('
        + (a * 180 / Math.PI * KITE.tip).toFixed(2) + ')');
      if (k.line) {
        k.line.setAttribute('d', 'M' + k.ax + ',' + k.ay + ' Q '
          + ((k.ax + x) / 2 + KITE.belly).toFixed(1) + ',' + ((k.ay + y) / 2).toFixed(1)
          + ' ' + x.toFixed(1) + ',' + (y + 14).toFixed(1));
      }
    });
  }

  // =======================================================================
  // CYCLISTS ON A PATH THAT CROSSES THE ROAD (.cc-cyclist).
  //
  // The first thing in the game that gives way to the ENGINE'S OWN TRAFFIC.
  // Everything else that waits is waiting for the gate; these wait for a gap in
  // the cars, which is a different lesson and the one every child is actually
  // taught: look, and cross when it is clear.
  //
  //   data-run="x0,x1"  the stretch of path it works, and it turns at each end
  //   data-y            the path's line
  //   data-scale · data-speed · data-nose
  //
  // The carriageway's edges are NOT declared — the engine already knows where the
  // road is at any y, so a scene that moves its road cannot leave this behind.
  //
  // ONCE IT STARTS, IT FINISHES. A rider that changes its mind halfway is worse
  // than one that never set off, so the gap is checked at the kerb and never
  // again until it is across.
  // =======================================================================
  // band: how close a car has to be to the line to be IN THE WAY, which is about
  // a car's own height at that depth and no more. It was 40, which is wider than
  // a car and meant a queue stopped 30px short of the crossing counted as
  // occupying it — so the moment the gate came down and the traffic backed up to
  // the stop line, the riders were sealed in for as long as the child held it.
  const BIKE = { band: 26, margin: 0.6 };

  /** Is anything coming that would meet THIS rider crossing at this line?

      Asked in SECONDS, not pixels. A fixed look-ahead is wrong twice over: it is
      the same for a rider who takes three seconds to cross and one who takes four,
      and it ignores how fast the car is actually going, which depends on how far
      down the road it is. Both sides are times now and the number tunes itself. */
  function trafficAt(b, y) {
    const need = (2 * roadHalf(y) + 2 * b.half) / b.speed + BIKE.margin;
    return cars.some(c => {
      if (c.phase !== 'road' || c.dead) return false;
      if (Math.abs(c.y - y) < BIKE.band) return true;          // on the crossing now
      const toward = (c.dir > 0 && c.y < y) || (c.dir < 0 && c.y > y);
      if (!toward) return false;
      // A CAR THAT IS NOT MOVING IS NOT COMING. Whatever is holding it — the
      // gate, a train, the car in front — it is not going to arrive while the
      // rider is on the road, and treating a stationary queue as traffic is what
      // made this crossing impassable exactly when it was safest.
      if (Math.abs(c.y - (c.y0 == null ? c.y : c.y0)) < 0.02) return false;
      const v = Math.max(1, c.speed * depthScale(c.y));
      return Math.abs(c.y - y) / v < need;
    });
  }

  function buildCyclists(svg) {
    const out = [];
    svg.querySelectorAll('.cc-cyclist').forEach(node => {
      const v = (node.getAttribute('data-run') || '').split(',').map(Number);
      const y = parseFloat(node.getAttribute('data-y'));
      if (v.length !== 2 || v.some(isNaN) || isNaN(y)) {
        console.warn('cc-cyclist needs data-run and data-y'); return;
      }
      const m = /translate\(\s*(-?[\d.]+)/.exec(node.getAttribute('transform') || '');
      const sc = parseFloat(node.getAttribute('data-scale')) || 1;
      out.push({ el: node, y: y, sc: sc,
                 x0: Math.min(v[0], v[1]), x1: Math.max(v[0], v[1]),
                 x: m ? +m[1] : v[0], dir: v[1] > v[0] ? 1 : -1,
                 nose: parseFloat(node.getAttribute('data-nose')) || 1,
                 speed: parseFloat(node.getAttribute('data-speed')) || 40,
                 half: 30 * sc, state: 'ride', wait: 0 });
    });
    return out;
  }

  function updateCyclists(dt) {
    const list = currentScene && currentScene.cyclists;
    if (!list || !list.length) return;
    const secs = dt / 1000;
    const half = roadHalf(list[0].y);
    const kerbW = ROAD_CX - half;               // the carriageway's own edges
    const kerbE = ROAD_CX + half;
    list.forEach(b => {
      const stopW = kerbW - b.half, stopE = kerbE + b.half;
      let want = b.x + b.dir * b.speed * secs;

      if (b.state !== 'cross') {
        // A LIMIT PER FRAME, never a position set at the moment of arrival. Set
        // once on the frame it reaches the kerb, a rider already a pixel short of
        // the line gets shoved BACKWARDS to make room for a queue — which is the
        // trap Mystic's cars fell into and it looks exactly as wrong here.
        let lim = null;
        const kerb = b.dir > 0 ? stopW : stopE;
        const before = b.dir > 0 ? b.x <= kerb : b.x >= kerb;
        if (before && trafficAt(b, b.y)) lim = kerb;
        // and fall in behind anyone already stopped, rather than on top of them
        const gap = b.half * 2 + 12;
        list.forEach(o => {
          if (o === b || o.state !== 'wait' || o.dir !== b.dir) return;
          const ahead = b.dir > 0 ? o.x > b.x : o.x < b.x;
          if (!ahead) return;
          const behind = b.dir > 0 ? o.x - gap : o.x + gap;
          lim = lim == null ? behind
              : (b.dir > 0 ? Math.min(lim, behind) : Math.max(lim, behind));
        });
        if (lim != null) want = b.dir > 0 ? Math.min(want, lim) : Math.max(want, lim);
        b.state = (Math.abs(want - b.x) < 0.01 && lim != null) ? 'wait' : 'ride';
        // ONCE IT SETS OFF IT FINISHES. A rider that changes its mind in the
        // middle of the road is worse than one that never left the kerb, so the
        // gap is checked here and not again until it is across.
        if ((b.dir > 0 ? want > stopW : want < stopE) && !trafficAt(b, b.y)) b.state = 'cross';
      } else if (b.dir > 0 ? b.x >= stopE : b.x <= stopW) {
        b.state = 'ride';
      }

      b.x = want;
      if (b.x >= b.x1) { b.x = b.x1; b.dir = -1; b.state = 'ride'; }
      else if (b.x <= b.x0) { b.x = b.x0; b.dir = 1; b.state = 'ride'; }

      const fwd = b.nose * b.dir;
      b.el.setAttribute('transform',
        'translate(' + b.x.toFixed(1) + ',' + b.y + ') scale('
        + (fwd * b.sc).toFixed(3) + ',' + b.sc + ')');
    });
  }

  // =======================================================================
  // THE LOCK (.cc-lock-water + .cc-lockboat + .cc-gate-l/.cc-gate-r).
  //
  // The first mechanism in the set that is ABOUT WAITING. A boat comes in, the
  // gates shut, nothing happens for a while, the water changes, the gates open
  // and it goes — which is you are safe, you wait, then you go, happening to a
  // boat a hundred feet from where it is about to happen to a car.
  //
  // Almost all of it is one number. The chamber is a single rect: set its `y`
  // and let the height follow, and the boat rides at the SAME y because its
  // origin is on its own waterline. Nothing is clipped, masked or duplicated.
  //
  // The band of visible water gets SMALLER as the level drops and that is
  // correct — you are looking across from the top of the near wall, so the wall
  // occludes more surface the further the water falls.
  //
  // What the eye actually catches is the WALL, and that needs no code at all:
  // the far wall is pale dry concrete down to the upper-pool line and painted
  // near-black with stain below it, so the rect uncovering it sweeps a hard dark
  // edge down a large pale surface. Do not fade or tint it — anything extra
  // fights the water and reads as a lighting bug.
  //
  // THE WAITING BEATS ARE THE POINT. A real lockage takes twenty minutes; this
  // one takes half a minute, and cutting the two still phases to make it brisker
  // would throw away the only reason the scene exists.
  // =======================================================================
  const LOCK = {
    low: 656, high: 596, floor: 698,   // lower pool, upper pool, the rect's fixed bottom
    shut: 1, open: 0.12,               // gate leaf scale — it foreshortens into its recess
    wait: 5, fill: 12, settle: 1.6, gates: 3, leave: 9, close: 3, drain: 9, back: 2.5,
    paddleSecs: 2,                     // one turn of the wheel
  };

  function buildLock(svg) {
    const water = svg.querySelector('.cc-lock-water');
    const boat = svg.querySelector('.cc-lockboat');
    if (!water || !boat) return null;
    const m = /translate\(\s*(-?[\d.]+)/.exec(boat.getAttribute('transform') || '');
    const path = svg.querySelector('[id$="lockboat-path"]');
    let total = 0;
    if (path && path.getTotalLength) { try { total = path.getTotalLength(); } catch (e) { total = 0; } }
    return {
      water: water, boat: boat, bx: m ? +m[1] : 962,
      paddle: boat.querySelector('.cc-paddle'),
      pt: (function () {
        const p = boat.querySelector('.cc-paddle');
        const q = p && /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(p.getAttribute('transform') || '');
        return q ? 'translate(' + q[1] + ',' + q[2] + ') ' : '';
      })(),
      leaves: [].map.call(svg.querySelectorAll('.cc-gate-l, .cc-gate-r'), el => {
        const q = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(el.getAttribute('transform') || '');
        return { el: el, t: q ? 'translate(' + q[1] + ',' + q[2] + ') ' : '' };
      }),
      path: path, total: total,
      phase: 'wait', t: 0, y: LOCK.low, sx: LOCK.shut, run: 0, spin: 0,
    };
  }

  function setLock(k) {
    k.water.setAttribute('y', k.y.toFixed(1));
    k.water.setAttribute('height', Math.max(0, LOCK.floor - k.y).toFixed(1));
    let x = k.bx;
    if (k.run > 0 && k.path && k.total) {
      const p = k.path.getPointAtLength(Math.min(k.total, k.run));
      x = p.x;
    }
    k.boat.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + k.y.toFixed(1) + ')');
    k.leaves.forEach(l => l.el.setAttribute('transform', l.t + 'scale(' + k.sx.toFixed(3) + ',1)'));
    // A PADDLEWHEEL TURNING WHILE THE BOAT SITS STILL is worse than one that
    // never turns, so it is driven by distance run and not by the clock.
    if (k.paddle) {
      k.paddle.setAttribute('transform', k.pt + 'rotate(' + k.spin.toFixed(1) + ')');
    }
  }

  function updateLock(dt) {
    const k = currentScene && currentScene.lock;
    if (!k) return;
    const secs = dt / 1000;
    k.t += secs;
    const ph = LOCK[k.phase];
    const u = ph ? clamp(k.t / ph, 0, 1) : 0;
    let moving = 0;

    if (k.phase === 'wait') {                       // shut, low, and NOTHING moves
      if (k.t >= LOCK.wait) { k.phase = 'fill'; k.t = 0; }
    } else if (k.phase === 'fill') {                // the chamber comes up to the upper pool
      k.y = LOCK.low + (LOCK.high - LOCK.low) * ease(u);
      if (u >= 1) { k.phase = 'settle'; k.t = 0; }
    } else if (k.phase === 'settle') {              // levels match. Still nothing moves
      if (u >= 1) { k.phase = 'gates'; k.t = 0; }
    } else if (k.phase === 'gates') {               // forty tons of steel, eased
      k.sx = LOCK.shut + (LOCK.open - LOCK.shut) * ease(u);
      if (u >= 1) { k.phase = 'leave'; k.t = 0; }
    } else if (k.phase === 'leave') {
      const was = k.run;
      k.run = (k.total || 500) * ease(u);
      moving = k.run - was;
      if (u >= 1) { k.phase = 'close'; k.t = 0; }
    } else if (k.phase === 'close') {
      k.sx = LOCK.open + (LOCK.shut - LOCK.open) * ease(u);
      if (u >= 1) { k.phase = 'drain'; k.t = 0; k.run = 0; }
    } else if (k.phase === 'drain') {               // back down, with the chamber empty
      k.y = LOCK.high + (LOCK.low - LOCK.high) * ease(u);
      if (u >= 1) { k.phase = 'back'; k.t = 0; }
    } else if (k.phase === 'back') {                // the next one comes in from the left
      k.run = -(k.total || 500) * 0.9 * (1 - ease(u));
      moving = Math.abs(k.run) * 0.02;
      if (u >= 1) { k.phase = 'wait'; k.t = 0; k.run = 0; }
    }

    if (moving > 0) k.spin += moving * (360 / (120 * LOCK.paddleSecs));
    setLock(k);
  }

  // =======================================================================
  // THE SWING BRIDGE (.cc-swing) and THE FUNICULAR (.cc-funi).
  //
  // The bridge is the lock gate's contract again: scale(sx,1) about the pivot,
  // eased, so the truss foreshortens to a narrow tower over its own pier — which
  // is what an end-on truss looks like. It runs RARELY. A bridge that is always
  // swinging is a fairground ride; one that swings occasionally is a railway.
  //
  // The funicular's only rule is that the two cars are COUNTERBALANCED: as one
  // goes up the other comes down, at the same rate. Both are sampled from one t,
  // one forward and one reversed, so they cannot drift apart even in principle.
  // =======================================================================
  const SWING = { closed: 1, open: 0.12, turn: 5, hold: 9, every: 105 };
  const FUNI = { secs: 20, hold: 3 };

  function buildSwing(svg) {
    const el = svg.querySelector('.cc-swing');
    if (!el) return null;
    const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(el.getAttribute('transform') || '');
    return { el: el, t: m ? 'translate(' + m[1] + ',' + m[2] + ') ' : '',
             sx: SWING.closed, phase: 'shut', clock: 0 };
  }

  function updateSwing(dt) {
    const g = currentScene && currentScene.swing;
    if (!g) return;
    const secs = dt / 1000;
    g.clock += secs;
    if (g.phase === 'shut') {
      if (g.clock >= SWING.every) { g.phase = 'opening'; g.clock = 0; }
    } else if (g.phase === 'opening') {
      g.sx = SWING.closed + (SWING.open - SWING.closed) * ease(clamp(g.clock / SWING.turn, 0, 1));
      if (g.clock >= SWING.turn) { g.phase = 'open'; g.clock = 0; }
    } else if (g.phase === 'open') {
      if (g.clock >= SWING.hold) { g.phase = 'closing'; g.clock = 0; }
    } else if (g.phase === 'closing') {
      g.sx = SWING.open + (SWING.closed - SWING.open) * ease(clamp(g.clock / SWING.turn, 0, 1));
      if (g.clock >= SWING.turn) { g.phase = 'shut'; g.clock = 0; }
    }
    g.el.setAttribute('transform', g.t + 'scale(' + g.sx.toFixed(3) + ',1)');
  }

  function buildFunis(svg) {
    const cars = [].map.call(svg.querySelectorAll('.cc-funi'), (el, i) => {
      const id = el.id || '';
      const key = id.slice(-1);                       // ...-a / ...-b
      const path = svg.querySelector('[id$="funi-path-' + key + '"]');
      let total = 0;
      if (path && path.getTotalLength) { try { total = path.getTotalLength(); } catch (e) {} }
      return { el: el, path: path, total: total, up: i === 0 };
    }).filter(c => c.path && c.total);
    return cars.length ? { cars: cars, t: 0, dir: 1, wait: 0 } : null;
  }

  function updateFunis(dt) {
    const f = currentScene && currentScene.funi;
    if (!f) return;
    const secs = dt / 1000;
    if (f.wait > 0) f.wait -= secs;
    else {
      f.t += f.dir * secs / FUNI.secs;
      if (f.t >= 1) { f.t = 1; f.dir = -1; f.wait = FUNI.hold; }
      else if (f.t <= 0) { f.t = 0; f.dir = 1; f.wait = FUNI.hold; }
    }
    f.cars.forEach(c => {
      // ONE t, sampled forward for one car and reversed for the other. Give them
      // a t each and they drift; counterbalanced means they cannot.
      const u = c.up ? f.t : 1 - f.t;
      const p = c.path.getPointAtLength(c.total * u);
      c.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')');
    });
  }

  // =======================================================================
  // A WAVING ARM (.cc-wave) — anywhere, not only on the Glacier bus.
  //
  //   data-pivot="x,y"   the SHOULDER, in the figure's own units
  //   data-i             its place in the group, so no two wave together
  //
  // Arms inside a .cc-tour are skipped: the tour bus already drives its own, and
  // two things writing one transform is how you get an arm that jitters.
  // =======================================================================
  const WAVER = { deg: 17, secs: 0.62, stagger: 0.29 };   // not WAVE — the tour bus owns that one

  function buildWaves(svg) {
    const out = [];
    svg.querySelectorAll('.cc-wave').forEach(node => {
      if (node.closest && node.closest('.cc-tour')) return;
      const p = (node.getAttribute('data-pivot') || '').split(',').map(Number);
      if (p.length !== 2 || p.some(isNaN)) { console.warn('cc-wave has no usable data-pivot'); return; }
      out.push({ el: node, px: p[0], py: p[1],
                 phase: (parseFloat(node.getAttribute('data-i')) || 0) * WAVER.stagger });
    });
    return out;
  }

  function updateWaves(t) {
    const list = currentScene && currentScene.waves;
    if (!list || !list.length) return;
    const secs = t / 1000;
    list.forEach(w => {
      const a = WAVER.deg * Math.sin((secs / WAVER.secs + w.phase) * TAU);
      w.el.setAttribute('transform',
        'rotate(' + a.toFixed(2) + ',' + w.px + ',' + w.py + ')');
    });
  }

  // =======================================================================
  // THE FERRY BERTH — lane signal, ramp and the waiting queue, as ONE sequence.
  //
  // This is the second waiting-and-going in the frame and the reason the scene
  // was chosen: cars wait in painted lanes for a signal and then go, a hundred
  // feet from where cars wait at a gate for a train and then go. Nobody has to
  // explain the connection, but it only works if the two are the SAME wait —
  // so the lane signal is red while the crossing gate is down and green a beat
  // after it lifts. The beat is the whole point: instant would read as one
  // switch, a beat reads as the berth noticing the road has cleared.
  //
  // Unlike Bentonville's bike signal this one is not a courtesy — the gate is
  // physically what is holding these cars, so the signal is reporting the road's
  // own state rather than borrowing the gate's.
  //
  // The ramp follows the signal, not the gate: down to load, and it lifts during
  // the long red when nothing is boarding. About fourteen degrees and no more —
  // a ferry ramp barely moves, and the drama is the road simply KEEPING GOING
  // onto a ship. Raise it further and the carriageway appears to break.
  //
  // The queue mostly holds its pose, because it is the picture of waiting. On
  // green each car shuffles a few pixels up its lane and stops; over the next red
  // it drifts back, which reads as the queue being refilled from behind. Driving
  // them off the frame empties the near field and costs more than it gains.
  // =======================================================================
  const BERTH = {
    beat: 1.3,          // after the gate lifts, before the lane goes green
    lift: -14,          // ramp, degrees
    rampSecs: 3.6, rampHold: 2.2,
    nudge: 9, nudgeSecs: 1.1,
    lane: { x: -0.25, y: -0.97 },       // the direction the lanes run
    redLit: '#ff3b30', redDark: '#5a1f1c',
    grnLit: '#34c759', grnDark: '#1f4a2c',
  };

  function buildBerth(svg) {
    const ramp = svg.querySelector('.cc-ramp-lift');
    const sig = svg.querySelector('[id$="cc-lane-signal"]');
    const cars = [].map.call(svg.querySelectorAll('.cc-queuecar'), el => {
      const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(el.getAttribute('transform') || '');
      return { el: el, x: m ? +m[1] : 0, y: m ? +m[2] : 0 };
    });
    if (!ramp && !sig && !cars.length) return null;
    const rm = ramp && /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(ramp.getAttribute('transform') || '');
    return {
      ramp: ramp, rt: rm ? 'translate(' + rm[1] + ',' + rm[2] + ') ' : '',
      red: sig && sig.querySelector('.cc-lamp-red'),
      green: sig && sig.querySelector('.cc-lamp-green'),
      cars: cars, go: false, t: 0, redT: 0, a: 0, k: 0, was: null,
    };
  }

  function updateBerth(dt) {
    const b = currentScene && currentScene.berth;
    if (!b) return;
    const secs = dt / 1000;
    const clear = !CC.gate.isBlocking();

    // The signal. Red the instant the gate drops; green only after the beat.
    // TWO CLOCKS, not one. `t` counts the beat before green and `redT` counts how
    // long the road has been shut — sharing one made the red branch reset it every
    // frame, so the ramp's hold never expired and it never lifted at all.
    if (!clear) { b.go = false; b.t = 0; b.redT += secs; }
    else { b.redT = 0; if (!b.go) { b.t += secs; if (b.t >= BERTH.beat) { b.go = true; b.t = 0; } } }
    if (b.go !== b.was) {
      b.was = b.go;
      if (b.red) b.red.setAttribute('fill', b.go ? BERTH.redDark : BERTH.redLit);
      if (b.green) b.green.setAttribute('fill', b.go ? BERTH.grnLit : BERTH.grnDark);
    }

    // The ramp. It waits out a brief red before bothering to lift.
    // Driven by the ROAD being shut, not by the lamp: it must come back down the
    // moment the gate lifts, not wait out the beat, or the first car up the
    // carriageway meets a ramp still on its way home.
    if (b.ramp) {
      const want = clear ? 0 : BERTH.lift;
      if (clear || b.redT >= BERTH.rampHold) {
        const step = Math.abs(BERTH.lift) * secs / BERTH.rampSecs;
        b.a += clamp(want - b.a, -step, step);
      }
      b.ramp.setAttribute('transform', b.rt + 'rotate(' + b.a.toFixed(2) + ')');
    }

    // The queue shuffles forward on green and drifts back on red.
    const wantK = b.go ? 1 : 0;
    b.k += clamp(wantK - b.k, -secs / BERTH.nudgeSecs, secs / BERTH.nudgeSecs);
    const e = ease(b.k);
    b.cars.forEach((c, i) => {
      const d = BERTH.nudge * (0.7 + 0.15 * (i % 3)) * e;
      c.el.setAttribute('transform',
        'translate(' + (c.x + BERTH.lane.x * d).toFixed(1) + ','
        + (c.y + BERTH.lane.y * d).toFixed(1) + ')');
    });
  }

  function buildFlags(svg) {
    const out = [];
    svg.querySelectorAll('.cc-flag').forEach(node => {
      const p = (node.getAttribute('data-pivot') || '').split(',').map(Number);
      if (p.length !== 2 || p.some(isNaN)) { console.warn('cc-flag has no usable data-pivot'); return; }
      const i = parseFloat(node.getAttribute('data-i')) || 0;
      out.push({ el: node, px: p[0], py: p[1], phase: i * FLAG.gust });
    });
    return out;
  }

  function updateFlags(t) {
    const list = currentScene && currentScene.flags;
    if (!list || !list.length) return;
    const secs = t / 1000;
    list.forEach(f => {
      const u = (secs / FLAG.secs + f.phase) * TAU;
      const a = FLAG.swing * Math.sin(u);
      // Not in step with the swing — a flag furls between gusts, not at the
      // bottom of every arc.
      const sx = 1 - FLAG.furl * (0.5 + 0.5 * Math.sin(u * 1.7 + 0.9));
      f.el.setAttribute('transform',
        'rotate(' + a.toFixed(2) + ',' + f.px + ',' + f.py + ') ' +
        'translate(' + f.px + ',' + f.py + ') scale(' + sx.toFixed(3) + ',1) ' +
        'translate(' + (-f.px) + ',' + (-f.py) + ')');
    });
  }

  // =======================================================================
  // A movable structure — the Mystic bascule (.cc-bascule-leaf).
  //
  // HEAD-ON, A LIFTING SPAN IS NOT A ROTATION. The deck's far edge rises and
  // its width changes as the perspective foreshortening unwinds, and no SVG
  // transform expresses that. So the art ships each piece as a four-point
  // polygon with its raised position in data-up, and the engine tweens the
  // points. That was the art side's call and it is the right one.
  //
  // The rule is: TWEEN ANYTHING THAT DECLARES A data-up. Four of the nine
  // centre-line dashes have none, because they are on the fixed span beyond the
  // leaf and must stay put — so declaring the raised state is also how the
  // artwork says which pieces move.
  //
  // The lift runs on its own timer and the gate buttons cannot trigger it. The
  // only coupling is one-way and defensive: it will not BEGIN while the
  // crossing gate is down, because that would shut the same road twice over
  // with nowhere for the traffic to wait. Nothing the child does is ever
  // blocked or interrupted by it — see AMBIENT.md on why the gate stays theirs.
  const BASCULE = {
    steps: [['idle', 13], ['warn', 1.4], ['boom', 1.2], ['settle', 0.8],
            ['lift', 3.2], ['open', 6.5], ['lower', 3.2], ['clear', 0.8], ['raise', 1.2]],
    ding: 1.35,       // seconds between bell strikes while it is working
  };

  function parsePts(s) {
    return (s || '').trim().split(/\s+/).map(p => p.split(',').map(Number))
      .filter(q => q.length === 2 && !q.some(isNaN));
  }

  // The channel traffic, which is the whole reason the bridge opens.
  //
  // Every mast here stands well above the closed deck, so nothing passes under
  // it — the boats hold short of the towers and go through together when the
  // span is up. That queue is worth more than staggering them: it makes the
  // bridge's purpose legible without a word of explanation.
  const CHANNEL = { hold: 528, space: 96, speed: 26, gap: [536, 744] };

  /** Is anything still between the towers? The span must not come down on it. */
  function channelBusy() {
    const c = currentScene && currentScene.channel;
    if (!c) return false;
    return c.boats.some(o => o.x > CHANNEL.gap[0] && o.x < CHANNEL.gap[1]);
  }

  function buildChannel(svg) {
    const path = svg.querySelector('[id$="channel-path"]');
    if (!path) return null;
    const boats = [].map.call(svg.querySelectorAll('.cc-sail, .cc-launch'), el => {
      const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)(?:\s*scale\(\s*([\d.]+))?/
        .exec(el.getAttribute('transform') || '');
      return { el: el, x: m ? +m[1] : 0, s: (m && m[3]) ? +m[3] : 1 };
    });
    if (!boats.length) return null;
    // Sample the path once so a boat can read its y from its x — the channel is
    // a gentle curve and following it beats a flat line.
    const L = path.getTotalLength(), N = 64, xs = [], ys = [];
    for (let i = 0; i <= N; i++) { const q = path.getPointAtLength(L * i / N); xs.push(q.x); ys.push(q.y); }
    return { boats: boats, xs: xs, ys: ys };
  }

  function channelY(c, x) {
    const xs = c.xs;
    if (x <= xs[0]) return c.ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) {
        const u = (x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1);
        return c.ys[i - 1] + (c.ys[i] - c.ys[i - 1]) * u;
      }
    }
    return c.ys[c.ys.length - 1];
  }

  function updateChannel(dt) {
    const c = currentScene && currentScene.channel;
    if (!c) return;
    // "Open" to a boat means the span is UP and staying up — the 'open' phase —
    // not merely part-way through a lift or a lower.
    const open = !!(currentScene.bascule && currentScene.bascule.phase === 'open');
    const secs = dt / 1000;
    // Front of the queue first, so they stack up rather than through each other.
    c.boats.slice().sort((a, b) => b.x - a.x).forEach((o, i) => {
      let want = o.x + CHANNEL.speed * secs;
      // RELEASED BY THE PHASE, NOT BY HOW OPEN IT LOOKS. Gating on openness let
      // boats keep feeding into the gap all through the descent — the span was
      // waiting for a channel that never cleared because more kept arriving.
      // Once the deck starts down, whoever is short of the line stays there.
      if (!open) {
        const line = CHANNEL.hold - i * CHANNEL.space;   // each waits behind the one ahead
        if (o.x <= line) want = Math.min(want, line);
      }
      o.x = want > 1400 ? -160 : want;
      o.el.setAttribute('transform',
        'translate(' + o.x.toFixed(1) + ',' + channelY(c, o.x).toFixed(1) + ') scale(' + o.s + ')');
    });
  }

  function buildBascule(svg) {
    const leaf = svg.querySelector('.cc-bascule-leaf');
    if (!leaf) return null;
    const movers = [];
    svg.querySelectorAll('.cc-bascule-quad[data-up], .cc-bascule-dashes [data-up]').forEach(el => {
      const from = parsePts(el.getAttribute('points'));
      const to = parsePts(el.getAttribute('data-up'));
      if (!from.length || from.length !== to.length) {
        console.warn('cc-bascule piece: points and data-up do not match');
        return;
      }
      movers.push({ el: el, from: from, to: to });
    });
    if (!movers.length) { console.warn('cc-bascule-leaf has nothing to move'); return null; }
    const weights = [].map.call(svg.querySelectorAll('.cc-bascule-weight'), el => ({
      el: el, dy: parseFloat(el.getAttribute('data-dy')) || 0,
    }));
    return { movers: movers, weights: weights, step: 0, t: 0, open: 0, ding: 0 };
  }

  /** Is the way over the bridge shut? Everything the traffic does hangs off
      this: nobody crosses, nobody queues past it, and — the part that is easy to
      forget — NOBODY ARRIVES FROM THE FAR SIDE EITHER, because nothing could
      have got over. A scene with no bascule is never shut. */
  function bridgeShut() {
    const b = currentScene && currentScene.bascule;
    if (!b) return false;
    const boom = currentScene.boom;
    return !boom || boom.a > -60;              // the arm anywhere near down
  }

  /** Where a car's run ends. Normally the far edge of the tarmac — but where the
      road carries ON over a bridge, a northbound car drives across and off the
      far bank instead of evaporating on the near abutment. */
  function carEndY() {
    const base = currentScene ? currentScene.roadTop : HORIZON;
    if (currentScene && currentScene.bascule && !bridgeShut()) return base - 62;
    // Same idea as the bascule: the road CARRIES ON, so the car's run does too —
    // here up the ramp and into the vehicle deck. The existing fade over the last
    // 46px then does the swallowing for nothing.
    if (currentScene && currentScene.carStyle === 'ferry') return base - 14;
    return base;
  }

  function updateBascule(dt) {
    const b = currentScene && currentScene.bascule;
    if (!b) return;
    const secs = dt / 1000;
    const step = BASCULE.steps[b.step];
    b.t += secs;

    // Two holds, both defensive, neither of them ever making the CHILD wait.
    //
    //   idle  — do not begin while the crossing gate is down; that would shut
    //           the same road twice with nowhere for the traffic to go.
    //   open  — do not begin lowering while a boat is still between the towers.
    //           Releasing the queue on a timer meant the last one was halfway
    //           through when the deck came down on top of it.
    const held = b.t >= step[1] &&
                 ((step[0] === 'idle' && CC.gate.isDown()) ||
                  (step[0] === 'open' && channelBusy()));
    if (!held && b.t >= step[1]) { b.t = 0; b.step = (b.step + 1) % BASCULE.steps.length; }

    const now = BASCULE.steps[b.step][0];
    b.phase = now;
    const u = Math.min(1, b.t / BASCULE.steps[b.step][1]);
    // How far open the leaf is, 0..1, eased so it starts and stops gently.
    let raw = now === 'lift' ? u : now === 'lower' ? 1 - u
            : (now === 'open') ? 1 : 0;
    b.open = raw * raw * (3 - 2 * raw);

    b.movers.forEach(m => {
      const pts = m.from.map((p, i) =>
        (p[0] + (m.to[i][0] - p[0]) * b.open).toFixed(1) + ',' +
        (p[1] + (m.to[i][1] - p[1]) * b.open).toFixed(1));
      m.el.setAttribute('points', pts.join(' '));
    });
    b.weights.forEach(w => w.el.setAttribute('transform', 'translate(0,' + (w.dy * b.open).toFixed(1) + ')'));

    // The boom is DOWN for everything except idle — it comes down first and
    // goes up last, so the road is shut before the deck ever moves.
    const boom = currentScene.boom;
    if (boom) {
      const wantUp = (now === 'idle') || (now === 'raise');
      const target = wantUp ? (isNaN(boom.up) ? -84 : boom.up) : (isNaN(boom.down) ? 0 : boom.down);
      const rate = 84 * secs / 1.2;
      boom.a += Math.max(-rate, Math.min(rate, target - boom.a));
      boom.el.setAttribute('transform',
        'rotate(' + boom.a.toFixed(1) + ' ' + boom.px + ' ' + boom.py + ')');
    }

    // Bell while it is working, lower and slower than the crossing's.
    if (now !== 'idle' && now !== 'open') {
      b.ding -= secs;
      if (b.ding <= 0) { b.ding = BASCULE.ding; CC.audio && CC.audio.bridgeDing && CC.audio.bridgeDing(); }
    } else { b.ding = 0; }
  }

  // =======================================================================
  // The Bailey Yard portal crane (.cc-gantry-trolley + .cc-gantry-hoist).
  //
  // It does two jobs with one set of hardware. Between trains it shuffles wagons
  // about the loading track — pick one up, carry it, set it down in an empty
  // slot — and that part is ambient and gate-blind like everything else back
  // here. When a train calls, `updateShunt` borrows the same crane and it loads
  // the child's train instead; see "The shunt is the exception" in AMBIENT.md.
  //
  // I first had it shuffle and nothing more, reasoning that Detroit already
  // loaded the train and two scenes doing the same thing was a waste. The
  // maintainer and his tester overruled that, and they were right: the coupling
  // moment is the best thing in Detroit, and "don't repeat yourself" is a rule
  // about code, not about fun. ONE driver at a time, though — whoever is
  // driving, the other stands off.
  //
  // REPARENT INTO .cc-crane-load, which is what the art put it there for. I
  // first drove the wagon's own transform instead — the crab's x and the hoist's
  // y are known every frame, so the maths is easy — and it moved correctly and
  // looked wrong: the loading track is painted before the diesel shop and the
  // gantry after it, so a lifted wagon slid up BEHIND the building while the
  // crane carrying it stayed in front.
  //
  // Inside the load group the offset is constant and falls out in one line. The
  // group sits under translate(tx,0) then translate(0, hoistY - homeY), and the
  // wagon is authored at absolute scene coordinates, so
  //     translate(-centreX, homeY - liftY)
  // hangs it under the spreader at every crab position and every hoist height.
  const GANTRY = { speed: 150, hoist: 200 };   // px per second

  function buildGantry(svg) {
    const trolley = svg.querySelector('.cc-gantry-trolley');
    const hoist = svg.querySelector('.cc-gantry-hoist');
    if (!trolley || !hoist) return null;
    // The ropes are drawn from the sheaves down to the spreader and they live
    // INSIDE the group we translate, so a bare translate drags their top ends
    // off the sheaves along with everything else. Remember where each one
    // starts; put it back every frame and the rope pays out instead of sliding.
    const ropes = [].map.call(hoist.querySelectorAll('line'),
      l => ({ el: l, y1: parseFloat(l.getAttribute('y1')) || 0 }));
    const homeX = attrNum(trolley, 'data-home-x', 807);
    const homeY = attrNum(hoist, 'data-home-y', 288);
    return {
      trolley: trolley, hoist: hoist, ropes: ropes, wagons: [], slots: [],
      minX: attrNum(trolley, 'data-min-x', 92), maxX: attrNum(trolley, 'data-max-x', 1188),
      homeY: homeY, topY: attrNum(hoist, 'data-top-y', 142),
      hook: svg.querySelector('.cc-crane-load'),
      homeX: homeX, x: homeX, y: homeY,
      phase: 'idle', t: 0, load: null, target: 0,
    };
  }

  /** The crane cannot shuffle wagons it cannot see.

      `buildRacks` swaps every authored drawing for a real piece of rolling stock
      once the scene is attached, so the list of things to lift can only be made
      HERE, after that has happened. Pointed at the hidden originals, the crane
      flew about the yard moving nothing at all. */
  function linkGantry(g, racks) {
    if (!g) return;
    g.wagons = racks || [];
    // Two more places to put one than there are wagons, so the shuffle can never
    // deadlock. Both are clear of the carriageway, which the loading track
    // crosses between 473 and 807.
    g.slots = g.wagons.map(w => w.x).concat([140, 1140]).sort((a, b) => a - b);
  }

  /** Where the spreader must be to have a grip on this wagon: ON its roof. A real
      spreader locks to the box; hang the load a hook's length below the beam and
      it reads as magnetised, with an invisible force holding the two apart. */
  const grabY = (g, r) => r.y - r.roofU * r.s;
  /** CARRY LOW, but high enough. data-top-y is the gantry's full travel, and
      hoisting a wagon that high puts it behind the diesel shop roof — out of
      sight for the whole traverse, which is the only part worth watching. One
      wagon's worth of daylight clears the neighbours it passes over, which is
      what a yard crane actually lifts. */
  const carryY = (g, r) => Math.max(g.topY, grabY(g, r) - r.roofU * r.s - 14);

  /** Put the crab at x and the spreader at y, and pay the ropes out to match. */
  function setGantry(g) {
    g.x = Math.max(g.minX, Math.min(g.maxX, g.x));
    const dy = g.y - g.homeY;
    g.trolley.setAttribute('transform', 'translate(' + g.x.toFixed(1) + ',0)');
    g.hoist.setAttribute('transform', 'translate(0,' + dy.toFixed(1) + ')');
    g.ropes.forEach(r => r.el.setAttribute('y1', (r.y1 - dy).toFixed(1)));
  }

  /** Slots with nothing standing in them. `ignore` is the wagon on the hook,
      which still remembers the slot it came from until it is set down. */
  function freeSlots(g, ignore) {
    return g.slots.filter(s => !g.wagons.some(w => w !== ignore && Math.abs(w.x - s) < 4));
  }

  function updateGantry(dt) {
    const g = currentScene && currentScene.gantry;
    if (!g || !g.wagons.length) return;
    // While a train is being loaded the shunt owns this crane. One driver.
    if (train.shunt) return;
    const secs = dt / 1000;
    const toward = (v, goal, rate) => {
      const d = goal - v, s = rate * secs;
      return Math.abs(d) <= s ? goal : v + (d > 0 ? s : -s);
    };

    // A TRAIN IS DUE, SO THE YARD CRANE GETS OUT OF THE WAY. A shuffle takes the
    // best part of fifteen seconds and the crane spends most of its life in one,
    // so a shunt that politely waited for a free crane never happened at all —
    // every train ran straight through a yard whose crane was busy. Now the
    // shuffle yields: it starts nothing new, and if it is holding a wagon it
    // sets it down at the NEAREST free slot instead of carrying it across. That
    // is a change of mind, not a teleport, and it takes a second or two.
    //
    // Yes, this reads the gate — the one thing back here that otherwise never
    // does. It is the only warning that a train is coming, and the traffic in
    // that direction is one-way: the crane listens, the gate never hears back,
    // and the game is exactly as it was.
    const yielding = train.active || CC.gate.isDown();

    if (g.phase === 'idle') {
      g.t += secs;
      g.y = toward(g.y, g.homeY, GANTRY.hoist);
      if (g.t > 1.6 && !yielding) {
        const free = freeSlots(g, null);
        const w = g.wagons[Math.floor(Math.random() * g.wagons.length)];
        if (free.length) {
          g.load = w; g.target = free[Math.floor(Math.random() * free.length)];
          g.phase = 'toSource';
        }
        g.t = 0;
      }
    } else if (yielding && g.load && (!g.hook || g.load.el.parentNode !== g.hook)) {
      // Nothing on the hook yet — just abandon the trip.
      g.load = null; g.phase = 'idle'; g.t = 0;
    } else if (g.phase === 'toSource') {
      const up = carryY(g, g.load);
      g.y = toward(g.y, up, GANTRY.hoist);
      g.x = toward(g.x, g.load.x, GANTRY.speed);
      if (g.x === g.load.x && g.y === up) g.phase = 'lower';
    } else if (g.phase === 'lower') {
      const on = grabY(g, g.load);
      g.y = toward(g.y, on, GANTRY.hoist);
      if (g.y === on) { g.phase = 'hooked'; g.t = 0; }
    } else if (g.phase === 'hooked') {
      g.t += secs;
      if (g.t > 0.5) {
        if (g.hook && g.load.el.parentNode !== g.hook) {
          // Remember the exact slot in the DOM, not just the parent. Putting
          // it back with appendChild moved it to the END of the layer, where it
          // drew in front of the fence and the men standing at the track.
          g.load.home = g.load.el.parentNode;
          g.load.after = g.load.el.nextSibling;
          g.hook.appendChild(g.load.el);
        }
        g.phase = 'raise';
      }
    } else if (g.phase === 'raise' || g.phase === 'carry') {
      if (yielding) {
        // Put it down at whichever free slot is closest, and be gone.
        const free = freeSlots(g, g.load);
        if (free.length) g.target = free.reduce((a, b) =>
          Math.abs(b - g.x) < Math.abs(a - g.x) ? b : a);
      }
      const up = carryY(g, g.load);
      if (g.phase === 'raise') {
        g.y = toward(g.y, up, GANTRY.hoist);
        if (g.y === up) g.phase = 'carry';
      } else {
        g.x = toward(g.x, g.target, GANTRY.speed);
        if (g.x === g.target) g.phase = 'set';
      }
    } else if (g.phase === 'set') {
      const w = g.load, on = grabY(g, w);
      g.y = toward(g.y, on, GANTRY.hoist);
      if (g.y === on) {
        w.x = g.target;                        // its new home on the loading track
        if (w.home && w.el.parentNode !== w.home) w.home.insertBefore(w.el, w.after);
        g.load = null; g.phase = 'idle'; g.t = -0.6;
      }
    }

    setGantry(g);
    g.wagons.forEach(w => {
      // On the hook the offset is CONSTANT: the group it hangs in is already
      // being moved by the crab and the hoist, and our rolling stock hangs off
      // its own middle, which is exactly where the hook is. On the ground it
      // simply stands in its slot.
      if (g.hook && w.el.parentNode === g.hook) {
        w.el.setAttribute('transform',
          'translate(0,' + (g.homeY + w.roofU * w.s).toFixed(1)
          + ') scale(' + w.s.toFixed(4) + ')');
      } else placeRack(w);
    });
  }

  // =======================================================================
  // VESSELS (.cc-vessel) — anything that drifts along a drawn line of water.
  //
  // Charleston's sloops and pilot launch and Glacier's kayaks are the same idea
  // twice: a small craft on a named path, going one way, wrapping round off-frame
  // and coming back. So they are one contract rather than two, and the next
  // harbour or river scene gets it for nothing.
  //
  //   data-path="harbour"   the engine finds [id*="harbour-path"]
  //   data-speed="-15"      px per second; NEGATIVE runs the path backwards
  //   data-t="0.40"         where on the path it starts, 0..1
  //   data-nose="1|-1"      -1 if the art is drawn facing the other way
  //   data-bob="1.1"        optional swell, in px
  //
  // The path carries the y, so a channel that recedes carries its vessels with
  // it and the art does not have to say so twice. Scale comes from the transform
  // the art was drawn with and is NOT depth-corrected: Glacier's kayaks are drawn
  // at roughly twice true scale on purpose, because a true-scale kayak at that
  // distance is a smudge, and "fixing" that would delete them.
  // Gate-blind, like everything else back here.
  // =======================================================================
  function buildVessels(svg) {
    const paths = {};
    const out = [];
    svg.querySelectorAll('.cc-vessel').forEach(el => {
      const key = el.getAttribute('data-path') || '';
      if (!paths[key]) {
        const p = svg.querySelector('[id*="' + key + '-path"]');
        if (!p) { console.warn('cc-vessel wants a path called ' + key); return; }
        paths[key] = { el: p, len: p.getTotalLength() };
      }
      const path = paths[key];
      if (!path) return;
      const m = /scale\(\s*(-?[\d.]+)/.exec(el.getAttribute('transform') || '');
      out.push({
        el: el, path: path,
        t: parseFloat(el.getAttribute('data-t')) || 0,
        speed: parseFloat(el.getAttribute('data-speed')) || 12,
        nose: parseFloat(el.getAttribute('data-nose')) || 1,
        bob: parseFloat(el.getAttribute('data-bob')) || 0,
        // The art's own scale, with any authored mirror taken out — data-nose is
        // the one place that decides which way round a vessel is drawn.
        s: m ? Math.abs(+m[1]) : 1,
        ph: out.length * 1.9,
      });
    });
    return out.length ? out : null;
  }

  function updateVessels(dt, now) {
    const list = currentScene && currentScene.vessels;
    if (!list) return;
    const secs = dt / 1000;
    list.forEach(v => {
      v.t += (v.speed / v.path.len) * secs;
      if (v.t > 1) v.t -= 1;
      if (v.t < 0) v.t += 1;
      const p = v.path.el.getPointAtLength(v.path.len * v.t);
      const y = p.y + (v.bob ? Math.sin(now / 1000 * 1.7 + v.ph) * v.bob : 0);
      v.el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + y.toFixed(1)
        + ') scale(' + (v.nose * v.s).toFixed(3) + ',' + v.s.toFixed(3) + ')');
    });
  }

  // =======================================================================
  // THE TOUR BUS (.cc-tour) — parked at a viewpoint with everybody waving, and
  // every so often it takes a run up the valley and comes back.
  //
  // IT NEVER TRAVELS BACKWARDS, and that costs a turn. The bus is drawn in
  // scenery-back, which is painted UNDER the carriageway, so it must stay on the
  // inn's side of the road — one exit, to the left. With only one exit the maths
  // is forced: bay to off-frame and back is two traversals, and one flip
  // off-screen leaves it facing the wrong way to set off again. So it turns twice
  // — once out of sight at the top of the valley, and once in its own bay, which
  // is what a bus in a car park actually does. The bay turn is a swing through
  // scaleX = 0 about the middle of the parking space, so the bus stays in its bay
  // and comes round on the spot.
  //
  //   data-bay    the LEFT EDGE of the parking space
  //   data-len    how long the bus is
  //   data-away   the left edge of where it waits, off frame
  // Gate-blind: the child can hold the gate down all day and the bus does not care.
  // =======================================================================
  function buildTour(svg) {
    const el = svg.querySelector('.cc-tour');
    if (!el) return null;
    const bay = attrNum(el, 'data-bay', NaN);
    if (isNaN(bay)) { console.warn('.cc-tour has no data-bay'); return null; }
    const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(el.getAttribute('transform') || '');
    return {
      el: el, bay: bay, y: m ? +m[2] : 0,
      len: attrNum(el, 'data-len', 120),
      away: attrNum(el, 'data-away', bay - 600),
      speed: attrNum(el, 'data-speed', 50),
      dwell: attrNum(el, 'data-dwell', 12),
      gone: attrNum(el, 'data-gone', 6),
      waves: [].map.call(el.querySelectorAll('.cc-wave'), (w, i) => {
        const p = (w.getAttribute('data-pivot') || '').split(',').map(Number);
        return { el: w, px: p[0] || 0, py: p[1] || 0, ph: i * 1.3 };
      }),
      // x is the body's LEFT EDGE and f is which way it is drawn: +1 as authored
      // (nose-left), -1 mirrored. It always drives the way its nose points.
      x: bay, f: 1, phase: 'park', t: 0,
    };
  }

  const WAVE = { deg: 13, hz: 1.45 };
  const TURN_SECS = 1.3;              // the swing round in the bay

  function updateTour(dt, now) {
    const b = currentScene && currentScene.tour;
    if (!b) return;
    const secs = dt / 1000;
    let f = b.f;

    if (b.phase === 'park') {                       // nose-left, waiting
      b.t += secs;
      if (b.t > b.dwell) { b.phase = 'out'; b.t = 0; }
    } else if (b.phase === 'out') {                 // up the valley
      b.x -= b.speed * secs;
      if (b.x <= b.away) { b.x = b.away; b.phase = 'gone'; b.t = 0; }
    } else if (b.phase === 'gone') {                // out of sight — turn here
      b.t += secs;
      if (b.t > b.gone) { b.f = f = -1; b.phase = 'back'; b.t = 0; }
    } else if (b.phase === 'back') {                // home again, nose-right
      b.x += b.speed * secs;
      if (b.x >= b.bay) { b.x = b.bay; b.phase = 'home'; b.t = 0; }
    } else if (b.phase === 'home') {                // nose-right, waiting
      b.t += secs;
      if (b.t > b.dwell) { b.phase = 'turn'; b.t = 0; }
    } else if (b.phase === 'turn') {                // swing round in the bay
      b.t += secs;
      f = -1 + 2 * clamp(b.t / TURN_SECS, 0, 1);
      if (b.t >= TURN_SECS) { b.f = f = 1; b.phase = 'park'; b.t = 0; }
    }

    // A mirrored group hangs to the LEFT of its origin, so the origin moves to the
    // far end of the body as f goes negative. One line covers driving, parking and
    // the swing, and keeps the body inside its bay the whole way round.
    const ox = b.x + b.len * (1 - f) / 2;
    b.el.setAttribute('transform', 'translate(' + ox.toFixed(1) + ',' + b.y
      + ') scale(' + f.toFixed(3) + ',1)');
    b.el.setAttribute('visibility', b.phase === 'gone' ? 'hidden' : 'visible');

    // They wave the whole time, parked or moving, and out of phase with each
    // other — five arms swinging as one is a machine, not a bus full of people.
    b.waves.forEach(w => {
      const a = Math.sin(now / 1000 * WAVE.hz * 2 * Math.PI + w.ph) * WAVE.deg;
      w.el.setAttribute('transform',
        'rotate(' + a.toFixed(1) + ',' + w.px + ',' + w.py + ')');
    });
  }

  // =======================================================================
  // A RIDE (.cc-ride) — a rider that follows a CHAIN of drawn paths, rotates to
  // the tangent, and obeys a signal partway along.
  //
  // Bentonville's timber wave and its jump line are on opposite sides of the
  // road and the only legal way between them is the Greenway crossing at the
  // front of the frame. That is the scene rather than an obstacle: one rider
  // makes one story out of both features and both sets of signals.
  //
  //   data-legs    ordered path ids, comma separated. "id@x0:x1" rides only the
  //                part of a path between two scene-x values, which is how the
  //                Greenway is joined at 452 and left at 756 without the art
  //                having to cut one path into three.
  //   data-speed   px per second along the path
  //   data-hold    "leg@x" — the scene-x to wait at until the bike signal is
  //                green, and the leg it counts on. The leg matters: the timber
  //                wave crosses the stop line's x as well, and a rider held
  //                there waits at a red light in the middle of a field.
  //   data-t       0..1, where round the chain to start
  //   data-nose    -1 only if the ART itself is drawn facing LEFT. Which way a
  //                rider faces as it travels is taken from the tangent, so a
  //                chain that runs right to left needs nothing said about it.
  //   data-hide    id of a second drawing of the SAME rider, hidden at mount
  //   data-turn    seconds to pause at each end, then walk back. Without it a ride
  //                LOOPS, which is right when both ends are off frame and wrong
  //                everywhere else: a tour party does not teleport to the start,
  //                it turns round — and a route whose end is a live carriageway
  //                must not run off the end of it at all.
  //   data-bob     px of vertical bob, out of phase per mover. At twenty pixels
  //                tall a walker reads as walking from a one-pixel bob and would
  //                not read at all from articulated legs.
  //   data-shadow-leg  "leg@x0:x1" — where `.cc-ride-shadow` tracks the rider. The  "leg@x0:x1" — where .cc-ride-shadow tracks the rider. The
  //                    range is the GAP, not the leg: a shadow cast on the face
  //                    of the ramp the rider is still climbing says nothing, and
  //                    the one thing that shape is for is saying AIRBORNE.
  //
  // ROTATE TO THE TANGENT and the jump costs nothing: nose-up off the lip and
  // nose-down onto the landing both fall out of the curve the art already drew.
  // =======================================================================
  const RIDE_SHADOW_Y = null;      // the shadow keeps whatever y it was drawn at

  /** How far along a path its point first reaches scene-x. Binary search, because
      a path is drawn as curves and there is no closed form — and these are all
      monotonic in x, which is the only case it has to serve. */
  function lengthAtX(p, total, x) {
    const xAt = (l) => p.getPointAtLength(l).x;
    const rising = xAt(total) >= xAt(0);
    let lo = 0, hi = total;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2;
      if ((xAt(m) < x) === rising) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  function buildRides(svg) {
    const out = [];
    svg.querySelectorAll('.cc-ride').forEach(el => {
      const spec = (el.getAttribute('data-legs') || '').split(',')
        .map(t => t.trim()).filter(Boolean);
      if (!spec.length) { console.warn('.cc-ride has no data-legs'); return; }
      const legs = [];
      let total = 0, bad = false;
      spec.forEach(raw => {
        const cut = raw.split('@');
        // Ids are namespaced per scene, so match on the END of the id. Every leg
        // name here is unique by its ending — "berm-path" does not match
        // "berm-run-in-path", which ends in "run-in-path".
        const p = svg.querySelector('[id$="' + cut[0] + '"]');
        if (!p || !p.getTotalLength) { console.warn('.cc-ride cannot find ' + cut[0]); bad = true; return; }
        const len = p.getTotalLength();
        let a = 0, b = len;
        if (cut[1]) {
          const xs = cut[1].split(':').map(Number);
          if (xs.length === 2 && !xs.some(isNaN)) {
            a = lengthAtX(p, len, xs[0]);
            b = lengthAtX(p, len, xs[1]);
          }
        }
        legs.push({ p: p, name: cut[0], a: a, b: b, at: total, len: Math.abs(b - a) });
        total += Math.abs(b - a);
      });
      if (bad || total <= 0) return;
      const hideId = el.getAttribute('data-hide');
      if (hideId) {
        const twin = svg.querySelector('[id$="' + hideId + '"]');
        // The same person drawn at two moments of one ride. Animate one and the
        // other has to go, or the scene has two of him.
        if (twin) twin.setAttribute('visibility', 'hidden');
      }
      const shRaw = (el.getAttribute('data-shadow-leg') || '').split('@');
      const shadowLeg = shRaw[0] || null;
      const shX = (shRaw[1] || '').split(':').map(Number);
      const shadow = shadowLeg ? svg.querySelector('.cc-ride-shadow') : null;
      // THE STOP LINE, RESOLVED ONCE, into a distance along the chain. Detecting
      // the crossing frame by frame looked simpler and was wrong: the berm's exit
      // curve doubles back on itself, so the rider reaches the stop line's x
      // travelling LEFT and the test never fired. A distance has no such case.
      const holdRaw = (el.getAttribute('data-hold') || '').split('@');
      let holdD = null;
      if (holdRaw.length === 2) {
        const leg = legs.filter(g => g.name === holdRaw[0])[0];
        const hx = parseFloat(holdRaw[1]);
        if (leg && !isNaN(hx)) {
          holdD = leg.at + Math.abs(lengthAtX(leg.p, leg.p.getTotalLength(), hx) - leg.a);
        } else console.warn('.cc-ride data-hold names no leg it rides: ' + holdRaw[0]);
      }
      out.push({
        el: el, legs: legs, total: total, holdD: holdD,
        d: (parseFloat(el.getAttribute('data-t')) || 0) * total,
        speed: parseFloat(el.getAttribute('data-speed')) || 80,
        nose: parseFloat(el.getAttribute('data-nose')) || 1,
        held: false,
        bob: parseFloat(el.getAttribute('data-bob')) || 0,
        turn: el.hasAttribute('data-turn') ? (parseFloat(el.getAttribute('data-turn')) || 0) : null,
        dir: 1, wait: 0,
        shadow: shadow, shadowLeg: shadowLeg,
        shadowX0: shX.length === 2 && !shX.some(isNaN) ? shX[0] : -1e9,
        shadowX1: shX.length === 2 && !shX.some(isNaN) ? shX[1] : 1e9,
      });
    });
    return out.length ? out : null;
  }

  /** Where on the chain, and which way is it pointing there. */
  function rideAt(r, d) {
    let leg = r.legs[r.legs.length - 1], into = 0;
    for (let i = 0; i < r.legs.length; i++) {
      if (d < r.legs[i].at + r.legs[i].len || i === r.legs.length - 1) {
        leg = r.legs[i]; into = clamp(d - leg.at, 0, leg.len); break;
      }
    }
    const fwd = leg.b >= leg.a ? 1 : -1;
    const l = leg.a + fwd * into;
    const p = leg.p.getPointAtLength(l);
    // The tangent from two samples 3px apart — enough to be stable on a straight
    // and still tight enough to follow the lip of the ramp.
    const q = leg.p.getPointAtLength(clamp(l + fwd * 3, 0, leg.p.getTotalLength()));
    return { x: p.x, y: p.y, vx: q.x - p.x, vy: q.y - p.y, leg: leg };
  }

  function updateRides(dt) {
    const list = currentScene && currentScene.rides;
    if (!list) return;
    const green = bikeGreen();
    const secs = dt / 1000;
    list.forEach(r => {
      let d = r.d;
      if (r.turn != null) {
        // THERE AND BACK. It stands a moment at each end and walks back the way
        // it came, which is the only honest thing to do when an end of the route
        // is somewhere you can see — or somewhere it must not go.
        if (r.wait > 0) r.wait -= secs;
        else {
          d += r.dir * r.speed * secs;
          if (d >= r.total) { d = r.total; r.dir = -1; r.wait = r.turn; }
          else if (d <= 0) { d = 0; r.dir = 1; r.wait = r.turn; }
        }
      } else {
        d += r.speed * secs;
        if (d >= r.total) d -= r.total;             // both ends are off frame
      }
      // Held at the line while the light is against them. A rider already past it
      // is never pulled back, and one that wrapped round is caught again next lap.
      r.held = false;
      if (r.holdD != null && !green && r.d <= r.holdD && d > r.holdD) {
        d = r.holdD; r.held = true;
      }
      r.d = d;
      const at = rideAt(r, d);
      // Walking the route BACKWARDS means the tangent points backwards too, or
      // the walker moonwalks home still facing the way it came.
      if (r.dir < 0) { at.vx = -at.vx; at.vy = -at.vy; }
      // WHICH WAY IT FACES COMES FROM THE TANGENT, and it MIRRORS rather than
      // rotating past vertical. Rotating a right-facing sprite to follow a
      // leftward tangent turns it upside down — which is what the rider did at
      // the end of the timber wave, and then waited at the red light inverted.
      // Mirroring keeps it the right way up going either way, and it means a
      // path that doubles back can never invert anything again.
      // A bob keyed to DISTANCE, not to the clock, so a mover that is standing
      // at a signal stands still instead of bouncing on the spot.
      const bob = (r.bob && r.wait <= 0) ? -Math.abs(Math.sin(d * 0.22)) * r.bob : 0;
      const fwd = r.nose * (at.vx >= 0 ? 1 : -1);
      const deg = fwd > 0 ? Math.atan2(at.vy, at.vx) : Math.atan2(-at.vy, -at.vx);
      r.el.setAttribute('transform',
        'translate(' + at.x.toFixed(1) + ',' + (at.y + bob).toFixed(2) + ') rotate('
        + (deg * 180 / Math.PI).toFixed(1) + ') scale(' + fwd + ',1)');
      // THE SHADOW IS THE CUE, and only over the gap. A dark ellipse on the dirt
      // directly beneath is what says AIRBORNE rather than standing on a rise
      // behind — and it only works while it is ON the dirt, so it shows for the
      // one leg that runs over it and hides everywhere else.
      if (r.shadow) {
        const on = at.leg.name === r.shadowLeg && at.x >= r.shadowX0 && at.x <= r.shadowX1;
        r.shadow.setAttribute('visibility', on ? 'visible' : 'hidden');
        if (on) r.shadow.setAttribute('cx', at.x.toFixed(1));
      }
    });
  }

  // =======================================================================
  // THE BIKE SIGNAL (.cc-bike-signal) — the one thing back here that is NOT
  // gate-blind, and deliberately so.
  //
  // The Greenway crosses the road at the front of the frame with a signal each
  // side, and it goes green when the RAILWAY gate is down and the cars have
  // stopped. That is the scene: a child watches a rider held at a red light
  // because a train is coming, and then released — the same lesson the gate
  // teaches, taught twice, without a word.
  //
  // The traffic is one way. The signal listens; the crossing never hears back,
  // its behaviour is byte for byte what it is everywhere else, and the game is
  // exactly as it was. See the note at the top of AMBIENT.md.
  //
  // The DELAY matters. Green on the same frame the gate drops reads as one
  // mechanism; a beat later reads as the crossing noticing the road has cleared.
  // =======================================================================
  const BIKE_SIG = { delay: 1.3,
                     redOn: '#ff3b30', redOff: '#5c1f1c',
                     greenOn: '#3fd06a', greenOff: '#1f4a2c' };

  function buildBikeSignals(svg) {
    const heads = [].map.call(svg.querySelectorAll('.cc-bike-signal'), el => ({
      red: el.querySelectorAll('.cc-lamp-red'),
      green: el.querySelectorAll('.cc-lamp-green'),
    }));
    if (!heads.length) return null;
    return { heads: heads, green: false, t: 0, painted: false };
  }

  /** Are the riders allowed across? False in any scene without a bike signal, so
      a ride in some other scene never waits for a light that is not there. */
  function bikeGreen() {
    const s = currentScene && currentScene.bikeSig;
    return s ? s.green : true;
  }

  function updateBikeSignals(dt) {
    const s = currentScene && currentScene.bikeSig;
    if (!s) return;
    const down = CC.gate.isDown();
    s.t = down ? s.t + dt / 1000 : 0;
    const green = down && s.t >= BIKE_SIG.delay;
    if (green === s.green && s.painted) return;
    s.green = green; s.painted = true;
    s.heads.forEach(h => {
      [].forEach.call(h.red, e => e.setAttribute('fill', green ? BIKE_SIG.redOff : BIKE_SIG.redOn));
      [].forEach.call(h.green, e => e.setAttribute('fill', green ? BIKE_SIG.greenOn : BIKE_SIG.greenOff));
    });
  }

  // =======================================================================
  // VULTURES (.cc-vulture) — two thermals, because one ring of birds all the
  // same size reads as a clock face.
  //
  // Each bird names its ring and where round it it starts. It SCALES with its
  // place on the ellipse — bigger at the near side, smaller at the far — or the
  // ring reads flat, and a slow rock of a few degrees is what a turkey vulture
  // actually does and costs one sine.
  // =======================================================================
  const VULTURE = { lift: 0.24, rock: 6, rockHz: 0.09 };

  function buildVultures(svg) {
    const out = [];
    svg.querySelectorAll('.cc-vulture').forEach(el => {
      const ring = svg.querySelector('[id$="' + (el.getAttribute('data-ring') || '') + '"]');
      if (!ring) { console.warn('.cc-vulture has no ring'); return; }
      const n = (a) => parseFloat(ring.getAttribute(a)) || 0;
      out.push({
        el: el, cx: n('cx'), cy: n('cy'), rx: n('rx'), ry: n('ry'),
        t: parseFloat(el.getAttribute('data-t')) || 0,
        tilt: parseFloat(el.getAttribute('data-tilt')) || 0,
        // A wider ring is a bigger circle, so it takes longer. That also keeps
        // the two kettles out of step without a magic number per scene.
        period: 18 + n('rx') / 12,
      });
    });
    return out.length ? out : null;
  }

  function updateVultures(dt, now) {
    const list = currentScene && currentScene.vultures;
    if (!list) return;
    list.forEach(v => {
      v.t = (v.t + dt / 1000 / v.period) % 1;
      const a = v.t * TAU;
      const near = Math.sin(a);                       // +1 at the near side
      const s = 1 + VULTURE.lift * near;
      const rock = Math.sin(now / 1000 * VULTURE.rockHz * TAU + v.t * 3) * VULTURE.rock;
      v.el.setAttribute('transform',
        'translate(' + (v.cx + v.rx * Math.cos(a)).toFixed(1) + ','
        + (v.cy + v.ry * near).toFixed(1) + ') rotate(' + (v.tilt + rock).toFixed(1)
        + ') scale(' + s.toFixed(3) + ')');
    });
  }

  // Chairs crawl up one cable and back down the other, wrapping at each end.
  // A lift is slow — a full traverse takes about twenty seconds, which is what
  // makes it read as a chairlift rather than a fairground ride.
  const CABLE_SPEED = 0.05;          // fraction of the cable per second

  // =======================================================================
  // The launch (Cape Canaveral). Sit on the pad, light up, climb out of frame,
  // wait, go again — with a real exhaust column rather than a painted one.
  // Ambient like the other scenery motion: the gate has no opinion about it.
  // =======================================================================
  const ROCKET = {
    hold: 4.5,        // seconds on the pad between launches
    accel: 62,        // px per second per second — slow off the pad, then quick
    gone: -560,       // climbed this far above her drawn position: out of frame
    rest: 3.0,        // seconds of empty sky before she is back on the pad
    puffEvery: 0.055, // seconds between exhaust puffs while thrusting
  };

  // =======================================================================
  // Chicago: the wheel, the L and the plane. All ambient — the gate has no
  // opinion about any of them.
  // =======================================================================
  function updateFerris(dt) {
    const list = currentScene && currentScene.ferris;
    if (!list || !list.length) return;
    list.forEach(f => {
      f.a = (f.a + 360 * (dt / 1000) / f.secs) % 360;
      f.el.setAttribute('transform', 'rotate(' + f.a.toFixed(2) + ')');
      // Each pod counter-rotates by the same amount, so it hangs level all the
      // way round instead of tumbling — which is what a real wheel's cars do,
      // and the reason the pods are a separate tagged group at all.
      f.pods.forEach(q => {
        q.el.setAttribute('transform',
          'translate(' + q.px + ',' + q.py + ') rotate(' + (-f.a).toFixed(2) + ')');
      });
    });
  }

  function updateShuttles(dt) {
    const list = currentScene && currentScene.shuttles;
    if (!list || !list.length) return;
    const secs = dt / 1000;
    list.forEach(s => {
      // Turning: hold at the end and swing round rather than flipping in a frame.
      if (s.turn > 0) {
        s.turn -= secs;
        if (s.turn <= 0) { s.dir = -s.dir; s.turn = 0; }
      } else {
        s.x += s.speed * s.dir * secs;
        if (s.x > s.x1) { s.x = s.x1; s.turn = s.bank ? 1.1 : 1.8; }
        else if (s.x < s.x0) { s.x = s.x0; s.turn = s.bank ? 1.1 : 1.8; }
      }
      // Mirror to face the way it is going. The art is drawn nose-right, so a
      // leftward run is scale(-1,1); the plane also tips its nose through the
      // turn, which reads as banking.
      const facing = s.dir > 0 ? 1 : -1;
      let tr = 'translate(' + s.x.toFixed(1) + ',' + s.y.toFixed(1) + ')';
      if (s.bank) {
        // Nose up a touch through the turn and level the rest of the time. The
        // rotate sits after the mirror in the transform list, so it is already
        // in screen space and needs no sign flip.
        const k = s.turn > 0 ? (1 - Math.abs(s.turn - 0.55) / 0.55) : 0;
        tr += ' rotate(' + (facing * -12 * k).toFixed(1) + ')';
      }
      // Mirror and size in one scale, so the two cannot fight each other.
      const sx = (facing !== s.nose ? -s.s : s.s);
      if (sx !== 1 || s.s !== 1) tr += ' scale(' + sx + ',' + s.s + ')';
      s.el.setAttribute('transform', tr);
    });
  }

  function updateRocket(dt) {
    const r = currentScene && currentScene.rocket;
    if (!r) return;
    const secs = dt / 1000;
    r.t += secs;

    if (r.phase === 'wait') {
      // Sitting on the pad: down at pad level, no flame, no cloud.
      r.dy = r.padDy; r.vel = 0;
      if (r.flame) r.flame.setAttribute('opacity', '0');
      if (r.glow) r.glow.setAttribute('opacity', '0');
      if (r.t > ROCKET.hold) { r.phase = 'burn'; r.t = 0; r.puffT = 0; }
    } else if (r.phase === 'burn') {
      r.vel += ROCKET.accel * secs;
      r.dy -= r.vel * secs;
      if (r.flame) r.flame.setAttribute('opacity', '1');
      if (r.glow) r.glow.setAttribute('opacity', '1');
      // Exhaust, thickest while she is still low over the pad.
      r.puffT = (r.puffT || 0) + secs;
      const low = r.dy > -230;
      while (r.puffT > ROCKET.puffEvery) {
        r.puffT -= ROCKET.puffEvery;
        if (low) emitRocketPuff(r);
      }
      if (r.dy < ROCKET.gone) { r.phase = 'rest'; r.t = 0; }
    } else {
      if (r.flame) r.flame.setAttribute('opacity', '0');
      if (r.glow) r.glow.setAttribute('opacity', '0');
      if (r.t > ROCKET.rest) { r.phase = 'wait'; r.t = 0; }
    }

    r.el.setAttribute('transform', 'translate(0,' + r.dy.toFixed(1) + ')');
    // The painted ground cloud belongs to the burn, so it comes and goes with it.
    if (r.cloud) {
      const want = r.phase === 'wait' ? 0 : (r.phase === 'burn' ? 1 : 0.35);
      r.cloud.setAttribute('opacity', want.toFixed(2));
    }
    updateRocketPuffs(r, secs);
  }

  function emitRocketPuff(r) {
    if (!r.puffG) return;
    // Blown out sideways along the flame trench, the way a real pad vents.
    const side = Math.random() < 0.5 ? -1 : 1;
    const c = el('ellipse', { fill: '#f4f6f7', cx: 0, cy: 0, rx: 12, ry: 8, opacity: 0.9 });
    r.puffG.appendChild(c);
    r.puffs.push({
      el: c,
      x: r.padX + (Math.random() * 40 - 20),
      y: r.padY + (Math.random() * 10 - 5),
      vx: side * (34 + Math.random() * 46),
      vy: -(10 + Math.random() * 26),
      rr: 12 + Math.random() * 10,
      o: 0.9,
    });
    if (r.puffs.length > 90) dropRocketPuff(r);
  }

  function dropRocketPuff(r) {
    const p = r.puffs.shift();
    if (p && p.el.parentNode) p.el.parentNode.removeChild(p.el);
  }

  function updateRocketPuffs(r, secs) {
    for (let i = r.puffs.length - 1; i >= 0; i--) {
      const p = r.puffs[i];
      p.x += p.vx * secs;
      p.y += p.vy * secs;
      p.vy *= 0.985;                 // the column slows as it billows
      p.rr += 26 * secs;
      p.o -= 0.30 * secs;
      if (p.o <= 0) {
        if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
        r.puffs.splice(i, 1);
        continue;
      }
      p.el.setAttribute('cx', p.x.toFixed(1));
      p.el.setAttribute('cy', p.y.toFixed(1));
      p.el.setAttribute('rx', p.rr.toFixed(1));
      p.el.setAttribute('ry', (p.rr * 0.62).toFixed(1));
      p.el.setAttribute('opacity', p.o.toFixed(2));
    }
  }

  function updateCableCars(dt) {
    const list = currentScene && currentScene.cablecars;
    if (!list || !list.length) return;
    const step = CABLE_SPEED * (dt / 1000);
    list.forEach(cc => {
      const ax = cc.a[0], ay = cc.a[1], bx = cc.b[0], by = cc.b[1];
      cc.chairs.forEach(ch => {
        // Lane 0 rides up the hill, lane 1 comes back down the lower cable.
        ch.t += ch.lane ? -step : step;
        // At each end the chair goes round the bullwheel and changes cable,
        // rather than wrapping. Wrapping teleported it from the bottom of the
        // cable back to the top — 124px across open sky, in full view, because
        // unlike the Colorado and Horseshoe runs BOTH ends of this cable are on
        // screen. Swapping lanes at the ends is also just what a lift does.
        if (ch.t > 1) { ch.t = 1; ch.lane = 1; }
        else if (ch.t < 0) { ch.t = 0; ch.lane = 0; }
        const x = ax + (bx - ax) * ch.t;
        const y = ay + (by - ay) * ch.t + (ch.lane ? cc.dy : 0);
        ch.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
      });
    });
  }

  function updateCurveTrain(dt) {
    const c = currentScene && currentScene.curve;
    if (!c) return;
    c.dist += CURVE.speed * (dt / 1000);
    // Loop with the whole consist clear of the start, so it re-enters rather
    // than blinking back into the middle of the bowl.
    // NO estimate of the train's length is used to decide when to wrap — see the
    // note after the walk below.

    // Walk the consist front to back, stepping by each vehicle's own length AT
    // ITS OWN DEPTH. The first version spaced everything by a fixed scale while
    // drawing each vehicle at its depth scale — so up at the apex, where things
    // are drawn a third of the size, the couplings tore open and the loco looked
    // joined to its wagons by nothing at all.
    let front = c.dist;                       // path distance of the train's nose
    c.cars.forEach(car => {
      const headP = c.path.getPointAtLength(clamp(front, 0, c.exitAt));
      const s = Math.max(0.05, curveDepth(headP.y));
      // A vehicle's origin sits (length - originFromRear) behind its own front.
      const at = front - (car.len - car.originFromRear) * s;
      front -= (car.len + CURVE.gap) * s;     // next vehicle's nose
      const on = at >= 0 && at <= c.exitAt;
      // Fade across the last stretch instead of cutting. Two reasons, and the
      // second is the honest one: it makes the exit smooth, AND #curve-path
      // drifts above the drawn rail past about x=1200, so a vehicle out there
      // rides visibly off the track. Rather than pretend the data fits, it is
      // faded out over exactly the stretch where it stops fitting.
      let op = 0;
      if (on) op = clamp(Math.min(at, c.exitAt - at) / CURVE.fade, 0, 1);
      car.el.setAttribute('opacity', op.toFixed(2));
      if (!on || op <= 0) return;
      const p = c.path.getPointAtLength(at);
      // Heading from a nearby second sample — atan2 of the difference. Sampling
      // forward near the end would clamp and give a heading of zero, so step
      // backwards there instead.
      const ahead = Math.min(at + 6, c.exitAt);
      const back = Math.max(at - 6, 0);
      const a = c.path.getPointAtLength(back), b = c.path.getPointAtLength(ahead);
      const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      car.el.setAttribute('transform',
        'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') rotate(' + deg.toFixed(1) + ') scale(' + s.toFixed(3) + ')');
      CC.rolling.roll(car.el, c.dist / CURVE.base, car.type);
    });

    // `front` is now the path position just behind the LAST vehicle — the true
    // tail, produced by the same depth-aware walk that just drew them. Restart
    // only once that has passed the end of the path.
    //
    // An estimated length does not work here, and it is worth knowing why: the
    // spacing uses the LOCAL depth at each vehicle, and near the ends of the
    // path (y=444) that scale is 0.48 against a mean of 0.23 — more than double.
    // So a train sitting over the ends is far longer than any average predicts.
    // Estimating it wrapped the train while 13 wagons were still in plain view.
    // Both ends of the path are off-screen (x=-92 and x=1360), so restarting the
    // instant the real tail clears is invisible: the train rolls off the right
    // one wagon at a time and a new head slides in from the left.
    if (front > c.exitAt) c.dist = 0;
  }

  // =======================================================================
  // The train
  // =======================================================================
  const train = { items: [], els: [], head: 0, dir: 1, span: 0, active: false,
                  lastChuff: 0, whistled: false };
  let puffs = [];
  let idleTrainTimer = 0;

  /** `extra` is ONE scene-local vehicle tacked on the back — Detroit's auto-rack.
      It is never written to CC.trains, so it cannot leak into the child's own
      train or survive leaving the place. A location must not overwrite what they
      built. */
  function buildConsist(extra) {
    train.els = [];
    if (!currentScene) return;
    currentScene.trainG.textContent = '';
    const list = CC.trains.vehicles().concat(extra ? [extra] : []);
    train.items = CC.rolling.layout(list, GAP);
    train.span = CC.rolling.span(train.items, GAP) * TRAIN_S;
    train.items.forEach(item => {
      const g = CC.rolling.build(item.type, item.colours);   // colours scoped to THIS vehicle
      currentScene.trainG.appendChild(g);
      train.els.push(g);
    });
    placeTrain();
    // trainG was just emptied, and the crane's hoist lives in it — it has to
    // share depth with the wagon it carries. The element itself survives, so
    // putting it back is enough.
    if (currentScene && currentScene.crane) currentScene.trainG.appendChild(currentScene.crane.hoist);
  }

  function placeTrain() {
    const dir = train.dir;
    const dist = (dir > 0 ? train.head : -train.head) / TRAIN_S;
    train.items.forEach((item, i) => {
      const g = train.els[i];
      if (!g) return;
      // The wagon coming off the siding drives its own transform until it is
      // coupled; two systems writing the same attribute is how you get a wagon
      // that flickers between two places.
      if (train.shunt && train.shunt.rollingIndex === i) return;
      const x = train.head + dir * item.offset * TRAIN_S;
      g.setAttribute('transform', 'translate(' + x.toFixed(2) + ',' + RAIL_Y + ') scale('
        + (dir > 0 ? TRAIN_S : -TRAIN_S) + ',' + TRAIN_S + ')');
      CC.rolling.roll(g, dist, item.type);
    });
    return dist;
  }

  function launchTrain() {
    if (train.active || !currentScene) return;
    train.dir = Math.random() < 0.5 ? 1 : -1;
    // Where there is a siding, every other train calls at it. Always would make
    // the place feel like a cutscene; never would mean a child waits for a coin
    // flip to show them the best thing in the scene. The shunt only works left
    // to right, so those runs take the direction they need.
    // Where there is a platform, every other train calls at it — same
    // reasoning as the siding, and the same left-to-right constraint, because
    // the waiting passengers are drawn for a train arriving from the left.
    train.halt = null;
    if (currentScene.halt) {
      currentScene.haltTurn = !currentScene.haltTurn;
      resetPlatform(currentScene.halt);
      if (currentScene.haltTurn) {
        train.dir = 1;
        train.halt = { stopHead: currentScene.halt.stopHead, dwell: currentScene.halt.dwell,
                       people: currentScene.halt.people, phase: 'run', t: 0 };
      }
    }
    train.shunt = null;
    if (currentScene.racks) {
      // Only a wagon actually hanging on the hook stops the shunt; a crane
      // merely travelling can simply be taken over. If it IS holding one, the
      // turn is not spent, so nothing is lost but a train.
      const gy = currentScene.gantry;
      const busy = gy && gy.load && gy.hook && gy.load.el.parentNode === gy.hook;
      if (gy && !busy) { gy.load = null; gy.phase = 'idle'; gy.t = 0; }
      if (!busy) currentScene.shuntTurn = !currentScene.shuntTurn;
      if (!busy && currentScene.shuntTurn) {
        train.dir = 1;
        // The wagon that joins the train is whichever one the crane picks up,
        // and a yard may hold more than one kind. Build with a guess, plan, and
        // if the plan wanted a different wagon, build that one and re-plan
        // around it — the second pass only moves the stopping place.
        const first = currentScene.racks[0].type;
        buildConsist({ type: first });
        train.shunt = planShunt();
        if (train.shunt && train.shunt.rack.type !== first) {
          const want = train.shunt.rack;
          buildConsist({ type: want.type });
          train.shunt = planShunt(want);
        }
        if (!train.shunt) buildConsist();           // would not fit — run a plain train
      }
    }
    train.head = train.dir > 0 ? -(420) : W + 420;
    train.active = true;
    train.whistled = false;
    train.lastChuff = CC.rolling.chuffIndex((train.dir > 0 ? train.head : -train.head) / TRAIN_S);
    CC.audio.whistle();
    setTrainVisible(true);
  }

  function setTrainVisible(on) {
    const s = train.shunt;
    train.els.forEach((g, i) => {
      // The wagon still standing on the siding is not part of the train yet.
      // This used to be hidden by hand at launch and then un-hidden half a line
      // later by this very function; it only stayed out of sight because
      // placeTrain happened to leave it parked off-frame. One place decides.
      const notYet = s && !s.picked && i === s.pickIndex;
      g.setAttribute('visibility', (on && !notYet) ? 'visible' : 'hidden');
    });
  }

  /** Is the train sitting on the crossing right now? Cars must not drive
      through it even if the gate happens to be up. */
  function trainOnCrossing() {
    if (!train.active) return false;
    const front = train.head;
    const back = train.head - train.dir * train.span;
    const lo = Math.min(front, back), hi = Math.max(front, back);
    return hi > CROSSING_X[0] && lo < CROSSING_X[1];
  }

  function updateTrain(dt) {
    if (!train.active) {
      // A closed gate means a train is coming. If the child holds it down,
      // another one comes along — that is the whole game.
      if (CC.gate.isDown()) {
        idleTrainTimer += dt;
        if (idleTrainTimer > 2600) { idleTrainTimer = 0; launchTrain(); }
      } else {
        idleTrainTimer = 0;
      }
      return;
    }
    updateShunt(dt);
    updateHalt(dt);
    train.head += train.dir * TRAIN_SPEED * shuntSpeed(dt) * haltSpeed() * dt / 1000;
    const dist = placeTrain();

    if (!train.whistled && Math.abs(train.head - ROAD_CX) < 320) { train.whistled = true; CC.audio.whistle(); }

    // Chuff + smoke share one trigger: a quarter turn of the driving wheels.
    const head = train.items[0];
    if (head && CC.rolling.isSteam(head.type)) {
      const idx = CC.rolling.chuffIndex(dist);
      if (idx !== train.lastChuff) {
        train.lastChuff = idx;
        CC.audio.chuff();
        emitPuff(head);
      }
    }

    const done = train.dir > 0 ? train.head > W + train.span + 80 : train.head < -train.span - 80;
    if (done) {
      train.active = false;
      setTrainVisible(false);
      idleTrainTimer = 0;
      // Put the siding back and drop the borrowed wagon. Off-screen, so free.
      if (train.halt) { resetPlatform(train.halt); train.halt = null; }
      if (train.shunt) {
        train.shunt.rack.el.setAttribute('visibility', 'visible');
        train.shunt = null;
        if (currentScene.crane) setCrane(currentScene.crane, SHUNT.park, null, 0);
        if (currentScene.gantry) {
          // Hand the crane back to the yard, with a pause before it finds
          // something else to do.
          const g = currentScene.gantry;
          g.load = null; g.phase = 'idle'; g.t = -1.2; g.y = g.homeY;
          setGantry(g);
        }
        buildConsist();
        setTrainVisible(false);
      }
    }
  }

  function emitPuff(head) {
    if (!currentScene) return;
    const S = CC.rolling.STACK;
    const c = el('circle', { fill: '#ffffff', cx: 0, cy: 0, r: 4 });
    currentScene.smokeG.appendChild(c);
    puffs.push({
      x: train.head + train.dir * (head.offset + S.x) * TRAIN_S,
      y: RAIL_Y + S.y * TRAIN_S,
      r: 4, o: 0.8, el: c, drift: -train.dir * 0.22,
    });
    if (puffs.length > 48) { const old = puffs.shift(); if (old.el.parentNode) old.el.parentNode.removeChild(old.el); }
  }

  function updateSmoke(dt) {
    const k = dt / 16.7;                    // the reference tuning was per-frame
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.y -= 0.5 * k; p.x += p.drift * k; p.r += 0.3 * k; p.o -= 0.009 * k;
      if (p.o <= 0) {
        if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
        puffs.splice(i, 1);
        continue;
      }
      p.el.setAttribute('cx', p.x.toFixed(1));
      p.el.setAttribute('cy', p.y.toFixed(1));
      p.el.setAttribute('r', p.r.toFixed(1));
      p.el.setAttribute('opacity', p.o.toFixed(3));
    }
  }

  function clearSmoke() {
    puffs.forEach(p => { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    puffs = [];
  }

  // =======================================================================
  // Road cars — from both directions, scaled by distance, stopping at
  // whichever gate faces them.
  // =======================================================================
  let cars = [];
  let carTimer = 0;
  let honkTimer = 0;
  let passed = 0;

  function spawnCar() {
    if (!currentScene || cars.length >= 8) return;
    const down = Math.random() < 0.5;                  // down = toward the viewer
    // Cars enter and leave at the FAR END OF THE ROAD, which is the horizon in
    // most scenes but not all — see roadTop. At Crater Lake that end is the Rim
    // Drive junction, so a car leaving there reads as turning off; at Horseshoe
    // it is the visitor car park, so it reads as parking. Either way nothing
    // drives past the tarmac.
    const top = currentScene ? currentScene.roadTop : HORIZON;
    const ex = currentScene ? currentScene.roadExit : null;
    // Nothing comes over a bridge that is shut.
    if (down && bridgeShut()) return;
    // Where the road carries on over a bridge, traffic coming towards us starts
    // at the FAR end of that run and drives across, rather than appearing on the
    // near abutment with the bridge behind it.
    const at = down ? carEndY() + 4 : H + 120;
    // Where the road turns, traffic coming toward us has driven in along the side
    // road rather than materialising at the end of ours.
    if (down && ex) {
      const car = newCar(1, ex.laneIn);
      // 'approach' comes in from the WEST and drives east to the junction;
      // 'enter' comes from the east and drives west to it.
      car.phase = ex.sameDir ? 'approach' : 'enter';
      car.x = ex.sameDir ? ex.fromX : ex.toX;
      cars.push(car); placeCar(car);
      return;
    }
    // Don't drop a car on top of one that has not got clear of the entrance yet.
    if (cars.some(c => c.dir === (down ? 1 : -1) && Math.abs(c.y - at) < carGap(at) * 1.2)) return;
    const car = newCar(down ? 1 : -1, at);
    cars.push(car);
    placeCar(car);
  }

  /** A car in its default state: on the carriageway, following its y. */
  function newCar(dir, y) {
    const car = {
      dir: dir,
      y: y,
      phase: 'road',
      x: null,
      colour: CAR_COLOURS[(Math.random() * CAR_COLOURS.length) | 0],
      speed: 150 + Math.random() * 40,                 // world speed; screen speed scales with depth
      stopped: false,
      counted: false,
      near: null,
    };
    car.el = buildCar(car.colour, car.dir);
    return car;
  }

  function placeCar(car) {
    // Traffic keeps right: cars coming toward us use the left half of the road.
    // A car on the side road steers by an explicit x instead of by its lane.
    const half = roadHalf(car.y);
    let x = car.x != null ? car.x : ROAD_CX + (car.dir > 0 ? -half * 0.5 : half * 0.5);
    let s = depthScale(car.y);
    // DRIVING ABOARD. Where the road ends inside a ship, a car going away does
    // not stop at the tarmac — it keeps going up the ramp and into the hold. Over
    // the last stretch it steers to the middle of the mouth, shrinks, and the
    // dark takes it. NOT CLIPPED: the obvious instinct is to mask the car against
    // the opening so it is properly occluded, and it cannot work, because the
    // road is painted after the ship — a clip that hides the car in the mouth
    // hides it on the road too. Shrink and fade is cheaper and is closer to what
    // driving into a dark hold actually looks like.
    if (currentScene && currentScene.carStyle === 'ferry'
        && car.phase === 'road' && car.dir < 0 && car.y < FERRY.from) {
      const k = ease(clamp((FERRY.from - car.y) / (FERRY.from - FERRY.aimY), 0, 1));
      x += (FERRY.aimX - x) * k;
      s *= 1 + (FERRY.minS - 1) * k;
    }
    // A car sprite is drawn nose-up/nose-down for a vertical carriageway. On the
    // side road it is travelling across the picture, so it has to be turned a
    // quarter. Both directions want the SAME +90: an outbound car carries a
    // nose-up sprite and ends up pointing east, an inbound one carries nose-down
    // and ends up pointing west, which is exactly right.
    // A car on the circuit is drawn in profile, so it must NOT be turned a
    // quarter the way a car on an ordinary side road is.
    const onTrack = car.phase !== 'road' && currentScene && currentScene.carStyle === 'race';
    if (currentScene && currentScene.carStyle === 'race') {
      const top = car.el.querySelector('.cc-car-top');
      const side = car.el.querySelector('.cc-car-side');
      if (top) top.setAttribute('visibility', onTrack ? 'hidden' : 'visible');
      if (side) side.setAttribute('visibility', onTrack ? 'visible' : 'hidden');
    }
    // WHICH WAY IT IS POINTING. The sprite's nose follows `dir`: +1 is drawn
    // facing the viewer (+y), -1 facing away (-y). A fixed rotate(90) happened
    // to be right for the two cases that existed — 'exit' (drawn facing away,
    // driving east) and 'enter' (drawn facing us, driving west) — and is wrong
    // for 'approach', which is drawn facing us and drives EAST. Those cars ran
    // down the street in reverse.
    const eastbound = car.phase === 'exit' || car.phase === 'approach';
    const deg = (eastbound ? -1 : 1) * (car.dir > 0 ? 90 : -90);
    const turn = (car.phase === 'road' || onTrack) ? '' : ' rotate(' + deg + ')';
    car.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + car.y.toFixed(1) + ')' + turn + ' scale(' + s.toFixed(3) + ')');
    // Fade over the last stretch before the road's far end. At the horizon a car
    // is tiny and this is invisible; on a truncated road it is what stops a
    // still-sizeable car from popping out of existence in mid-picture.
    const top = carEndY();
    // Fade only applies to the carriageway. A car that has turned onto the side
    // road sits just above the road's end by y, and would otherwise be dimmed
    // for its whole run along a road it is legitimately driving on.
    // And where the road HAS somewhere to go, there is nothing to fade for: every
    // car either turns off at the junction or arrives from it, so none of them
    // ever reaches the end. Sun Valley's cross street sits 7px past the tarmac,
    // well inside the 46px fade, so cars were turning onto it at 7% opacity and
    // running the street invisible. Crater Lake never showed this because its
    // junction is 64px clear of the road's end.
    const fades = car.phase === 'road' && !(currentScene && currentScene.roadExit);
    car.el.setAttribute('opacity',
      fades ? clamp((car.y - top) / CAR_FADE, 0, 1).toFixed(2) : '1');
    // A car past the middle of the tracks is in front of the train; before it,
    // behind. Reparent only when that actually changes.
    const near = car.y > CROSS_MID;
    if (car.near !== near) {
      car.near = near;
      (near ? currentScene.carsNear : currentScene.carsFar).appendChild(car.el);
    }
  }

  /** How much room a car needs in front of it at this distance. In perspective
      a fixed gap on the road shrinks on screen, so the gap scales too. */
  const carGap = (y) => 165 * depthScale(y);

  /** Cars on the side road at a scene whose carriageway turns (Crater Lake).
      Rim Drive runs at a constant depth, so a car on it keeps one size and one
      y and simply tracks across — which is exactly how it looks from the rim.
      Returns true if it handled this car and the carriageway logic should skip it. */
  // Joining a circuit is not like joining a lane of shops. A car comes off the
  // access road at road pace — about 65px/s at that depth — where the pack runs
  // at 210 and up, so it has to wind up to speed rather than trundle among them.
  // Coming the other way it arrives at racing speed and has to shed it before
  // the turn, which is what a slip road is for.
  const RACE_JOIN = { top: 220, accel: 90, brakeOver: 340 };

  function driveSideRoad(car, secs) {
    const ex = currentScene && currentScene.roadExit;
    if (!ex) return false;
    const onCircuit = currentScene.carStyle === 'race';

    if (car.phase === 'exit') {
      let v = car.speed * depthScale(car.y);
      if (onCircuit) {                                   // wind up to racing speed
        car.v = (car.v == null ? v : Math.min(RACE_JOIN.top, car.v + RACE_JOIN.accel * secs));
        v = car.v;
      }
      car.x += v * secs;
      if (car.x > ex.toX) car.dead = true;
      return true;
    }
    if (car.phase === 'approach') {
      // It turns down over the CARRIAGEWAY'S CENTRE, not over the junction
      // marker. jx is where the side road meets the main one, which at Ketchum
      // is 668 — 28px right of the road's centre at 640 — so the car drove past
      // the turn and then snapped backwards onto the lane to make it.
      //
      // And it gives way. Dropping onto the carriageway without looking put it
      // straight on top of anything coming up from the bottom of the frame; now
      // it holds at the junction until there is room, which is what the queue
      // behind it is for.
      let v = car.speed * depthScale(car.y);
      if (onCircuit) {                                   // arrive fast, brake for the turn
        const togo = ROAD_CX - car.x;
        const k = Math.max(0, Math.min(1, togo / RACE_JOIN.brakeOver));
        v = v + (RACE_JOIN.top - v) * k;
      }
      const want = car.x + v * secs;
      if (want < ROAD_CX) { car.x = want; return true; }
      const blocked = cars.some(c => c.phase === 'road' &&
                                     Math.abs(c.y - ex.y1) < carGap(ex.y1));
      if (blocked) { car.x = ROAD_CX; return true; }        // wait for a gap
      car.phase = 'road'; car.x = null; car.y = ex.y1;
      return true;
    }
    if (car.phase === 'enter') {
      car.x -= car.speed * depthScale(car.y) * secs;
      // Reached the junction: swing onto our carriageway and head down.
      if (car.x <= ex.jx + 16) { car.phase = 'road'; car.x = null; car.y = ex.y1; }
      return true;
    }
    // Going away from the viewer and has reached the junction: turn right —
    // but only into a space. It used to appear on the side road regardless, and
    // where a car was already sitting at the junction waiting to turn down, the
    // new one materialised about 19px in front of it while the queue wants 47.
    // The gap was then made by moving the one BEHIND, so both slid west for a
    // moment before the waiting one turned. It gives way instead.
    if (car.dir < 0 && car.y <= ex.y1) {
      // It used to appear on the side road at a fixed spot regardless, and where
      // a car was already sitting at the junction waiting to turn down, the new
      // one materialised about 19px in front of it while the queue wants 47 —
      // and the gap was then made by moving the one BEHIND, so both slid west
      // for a moment.
      //
      // Refusing to turn until the junction was clear deadlocked it instead: the
      // waiting car cannot turn down until the carriageway clears, and it was
      // blocking the only way off the carriageway. So it pulls out AHEAD of
      // anything stationary there, which is what a car turning right past a
      // queue actually does.
      const gap = carGap(ex.laneOut);
      let spot = ROAD_CX + roadHalf(ex.laneOut) * 0.5;
      cars.forEach(c => {
        if (c === car || (c.phase !== 'exit' && c.phase !== 'approach')) return;
        if (c.x > spot - gap && c.x < spot + gap * 2) spot = Math.max(spot, c.x + gap);
      });
      car.holdY = null;
      car.phase = 'exit';
      car.y = ex.laneOut;
      car.x = spot;
      return true;
    }
    car.holdY = null;
    return false;
  }

  /** Where traffic coming TOWARD the viewer has to wait for the gate.

      STOP_FAR is a fixed 396, which quietly assumes every road runs to the
      horizon with plenty of tarmac above the far gate to queue on. Two scenes
      truncate below that line — Detroit's stops at the plant gate at y=424 —
      so a car spawned at the road's own start (roadTop + 4 = 428) was ALREADY
      past its stop line, tested as "not before the line", and drove straight
      through a closed crossing. Always from the same direction, which is the
      tell: it is the far lane, in the scenes whose far end is too low.

      Clamping it to the road fixes every such scene at once and changes nothing
      anywhere else, since roadTop is 300 in most of them. Where the road starts
      that low there is no room to queue between it and the rails, so the car
      waits essentially at the point it appears — and since cars fade in over
      the first 46px of road, it waits invisibly and drives in when the gate
      lifts. Better than a car standing on the ballast, and far better than one
      driving through a closed gate. */
  function farStopLine() {
    const top = currentScene ? currentScene.roadTop : HORIZON;
    return Math.max(STOP_FAR, top + 4);
  }

  function updateCars(dt) {
    const blocked = CC.gate.isBlocking() || trainOnCrossing();
    const secs = dt / 1000;

    // Each lane is a queue. Walk it from the front so every car knows what it
    // has to stop behind — the gate for the leader, the car ahead for the rest.
    // Side-road traffic first: a car that has turned off is no longer part of
    // the carriageway queue and must not be given a stop line on it.
    // Where everything was before this frame moved it. The queue uses it to
    // hold a car rather than shove it backwards — see below.
    cars.forEach(car => { car.x0 = car.x; car.y0 = car.y; });
    cars.forEach(car => { car.offRoad = driveSideRoad(car, secs); });
    // Rim Drive is a queue too. Without this, two cars released together at the
    // gate turn together and then sit 7px apart the whole way across.
    // 'exit' and 'approach' share one eastbound lane where the street is
    // one-way, so they queue as a single line — otherwise a car turning out of
    // the junction lands on top of one already driving past it.
    [['exit', 'approach'], ['enter']].forEach(group => {
      const east = group[0] !== 'enter';
      const lane = cars.filter(c => group.indexOf(c.phase) >= 0)
        .sort((a, b) => east ? b.x - a.x : a.x - b.x);           // front first
      let limit = null;
      lane.forEach(c => {
        const gap = 150 * depthScale(c.y);
        if (limit != null) c.x = east ? Math.min(c.x, limit) : Math.max(c.x, limit);
        // KEEPING A GAP CAN HOLD A CAR, NEVER SHOVE IT BACKWARDS. If the one in
        // front appeared closer than the gap — which is exactly what a car
        // turning out of the junction does — capping the follower dragged it the
        // wrong way up the street for a frame or two.
        if (c.x0 != null) c.x = east ? Math.max(c.x, c.x0) : Math.min(c.x, c.x0);
        limit = east ? c.x - gap : c.x + gap;
      });
    });

    [1, -1].forEach(dir => {
      const lane = cars.filter(c => c.dir === dir && c.phase === 'road')
        .sort((a, b) => dir > 0 ? b.y - a.y : a.y - b.y);   // front of the queue first
      const stopLine = dir > 0 ? farStopLine() : STOP_NEAR;
      let limit = null;                                     // set by the car ahead
      lane.forEach(car => {
        const step = car.speed * depthScale(car.y) * secs;
        let want = car.y + dir * step;
        // Note the >= : a car that has arrived EXACTLY on the stop line is still
        // waiting at it. With a strict comparison it counts as past the line on
        // the very next frame and drives straight through the closed gate — one
        // car escaping per cycle, which is easy to miss and looks like magic.
        const beforeLine = dir > 0 ? car.y <= stopLine : car.y >= stopLine;
        if (blocked && beforeLine) {
          want = dir > 0 ? Math.min(want, stopLine) : Math.max(want, stopLine);
        }
        // Gather every reason this car cannot go further into ONE limit, then
        // apply it once. Clamping `want` in stages and then second-guessing the
        // result is what made the queue oscillate: the keep-clear rule fired only
        // on the frame a car was actually pinned, shoved it back to the near side
        // of the rails, and then let it creep forward again until it was pinned
        // once more. A limit cycle, about 30px wide, for every car behind the
        // second. Snap the LIMIT out of the danger and the car simply rests.
        let lim = limit;
        const closer = (a, b) => a == null ? b : b == null ? a : (dir > 0 ? Math.min(a, b) : Math.max(a, b));
        if (dir < 0 && bridgeShut()) lim = closer(lim, BRIDGE_STOP);
        if (car.holdY != null) lim = closer(lim, car.holdY);
        // NOBODY WAITS ON THE CROSSING. A driver does not stop on a level
        // crossing and this game least of all should draw one parked on the
        // rails. A limit that lands in the track band becomes the near side of
        // it — which is what makes Mystic's queue read as a real one: one at the
        // boom, one in the gap before the rails, the rest behind the crossing.
        if (lim != null && lim > CROSS_KEEP[0] && lim < CROSS_KEEP[1]) {
          lim = dir > 0 ? CROSS_KEEP[0] : CROSS_KEEP[1];
        }
        if (lim != null) want = dir > 0 ? Math.min(want, lim) : Math.max(want, lim);
        car.stopped = Math.abs(want - car.y) < step * 0.4;
        car.y = want;
        limit = car.y - dir * carGap(car.y);
      });
    });

    for (let i = cars.length - 1; i >= 0; i--) {
      const car = cars[i];
      if (!car.counted && (car.dir > 0 ? car.y > CROSS_MID : car.y < CROSS_MID)) {
        car.counted = true;
        passed++;
        CC.emit && CC.emit('carpassed', passed);
      }
      placeCar(car);
      // Gone once it reaches the end of the tarmac (it has already faded to
      // nothing by then) or has driven off the bottom of the frame.
      //
      // ONLY ON THE CARRIAGEWAY. A car that has turned onto a side road is not
      // finished with, and at Sun Valley the cross street lies ABOVE the road's
      // far end, so this deleted every car the moment it turned — the junction
      // worked perfectly and nothing was ever seen using it. A side-road car
      // ends on car.dead instead, when it runs off the frame.
      const offTarmac = car.phase === 'road' && car.y < carEndY();
      if (car.dead || offTarmac || car.y > H + 170) {
        if (car.el.parentNode) car.el.parentNode.removeChild(car.el);
        cars.splice(i, 1);
      }
    }

    carTimer += dt;
    if (carTimer > 1500) { carTimer = 0; spawnCar(); }

    // The occasional impatient beep while cars wait — friendly, never nagging.
    honkTimer += dt;
    if (honkTimer > 2600) {
      honkTimer = 0;
      if (CC.gate.state === 'closed' && cars.some(c => c.stopped) && Math.random() < 0.5) CC.audio.honk();
    }
  }

  function clearCars() {
    cars.forEach(c => { if (c.el.parentNode) c.el.parentNode.removeChild(c.el); });
    cars = [];
  }

  // =======================================================================
  // Gates — the scene's own, both moving together, always.
  // =======================================================================
  function drawGates(now) {
    if (!currentScene) return;
    const a = CC.gate.angle;                      // 0 = up, 90 = down
    const raised = 90 - a;
    currentScene.arms.forEach(arm => {
      arm.el.setAttribute('transform', 'translate(0,40) rotate(' + (arm.sign * raised).toFixed(2) + ')');
    });
    const flashing = CC.gate.state !== 'open';
    const phase = flashing ? (Math.floor(now / 280) % 2) : -1;
    currentScene.lamps.forEach(l => {
      l.el.setAttribute('fill', l.phase === phase ? '#ff2a2a' : '#7a1c1c');
    });
  }

  // =======================================================================
  // The loop
  // =======================================================================
  // Scenery trains (Colorado's trestle). The ART decides how far along its rail
  // the train runs, via data-run="min max" in Bezier t. That matters because the
  // train has length: run it the full 0..1 and a third of it hangs off the end
  // of the bridge in mid-air, since the trestle is drawn IN FRONT of the slopes
  // and nothing occludes it. Colorado's range keeps every wagon on the deck.
  // data-fade is how much of each end is spent fading, so it eases in and out
  // instead of popping.
  // =======================================================================

  /** A quadratic Bezier through rail[0..2], extended along the end tangents so
      the train can run on and off the ends instead of stopping dead on them. */
  function onRail(rail, t) {
    const p0 = rail[0], p1 = rail[1], p2 = rail[2];
    if (t < 0) return { x: p0[0] + t * 2 * (p1[0] - p0[0]), y: p0[1] + t * 2 * (p1[1] - p0[1]) };
    if (t > 1) return { x: p2[0] + (t - 1) * 2 * (p2[0] - p1[0]),
                        y: p2[1] + (t - 1) * 2 * (p2[1] - p1[1]) };
    const u = 1 - t;
    return { x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
             y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1] };
  }

  function updateScenery(dt) {
    if (!currentScene || !currentScene.sceneryTrains) return;
    currentScene.sceneryTrains.forEach(st => {
      const runMs = st.secs * 1000;
      st.phase = (st.phase + dt) % (runMs + st.pause * 1000);
      if (st.phase >= runMs) { st.el.setAttribute('opacity', '0'); return; }   // waiting for the next run
      const t0 = st.run[0], t1 = st.run[1];
      const t = t0 + (st.phase / runMs) * (t1 - t0);
      const at = onRail(st.rail, t);
      st.el.setAttribute('transform',
        'translate(' + at.x.toFixed(1) + ',' + (at.y + st.lift).toFixed(1) + ')');
      const fade = Math.min((t - t0) / st.fade, (t1 - t) / st.fade);
      st.el.setAttribute('opacity', clamp(fade, 0, 1).toFixed(2));
    });
  }

  // =======================================================================
  let last = 0;
  let running = false;

  function frame(t) {
    if (!running) return;
    const dt = last ? Math.min(t - last, 50) : 16;
    last = t;
    CC.gate.tick(dt);
    updateTrain(dt);
    updateSmoke(dt);
    updateCars(dt);
    updateScenery(dt);
    updateCurveTrain(dt);
    updateCogTrain(dt);
    updateCoasters(dt);
    updateSpinners(dt);
    updateSwarms(t);
    updateChases(t);
    updateRoutes(dt);
    updateBalloons(t, dt);
    updateFalls(t);
    updateBoom(dt);
    updateGantry(dt);
    updateBascule(dt);
    updateChannel(dt);
    updateIdles(t);
    updateDrifts(t, dt);
    updateFlags(t);
    updateJets(t);
    updateKites(t);
    updateLock(dt);
    updateBerth(dt);
    updateWaves(t);
    updateSwing(dt);
    updateFunis(dt);
    updateCyclists(dt);
    // AMBIENT, so they belong HERE and not in updateTrain — that returns early
    // when no train is on screen, which would freeze the bus halfway down the
    // street and stop the water park entirely between trains. The bus is only
    // TRIGGERED by a transfer; everything after that is its own business.
    updateBusStop(dt);
    updateSlide(dt);
    updateTube(dt);
    updateDuck(dt, t);
    updateWatchers(dt);
    updatePumpjacks(t);
    updateDustDevil(dt, t);
    updateGeysers(t);
    updateAurora(t);
    updateCanters(dt);
    updateCrawls(dt);
    updateRace(dt);
    updateLifts(t);
    updateSkiers(dt);
    updateVessels(dt, t);
    updateBikeSignals(dt);        // before the rides: they read its aspect
    updateRides(dt);
    updateVultures(dt, t);
    updateTour(dt, t);
    updatePloughs(dt);
    updateCableCars(dt);
    updateRocket(dt);
    updateFerris(dt);
    updateShuttles(dt);
    drawGates(t);
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  // =======================================================================
  const scene = {
    W: W, H: H, RAIL_Y: RAIL_Y, TRAIN_S: TRAIN_S,

    get carsPassed() { return passed; },
    resetCounter() { passed = 0; CC.emit && CC.emit('carpassed', 0); },

    init() {
      stage = document.getElementById('stage');
      if (!stage) { console.error('no #stage element'); return; }
      this.show(CC.world.current, { instant: true });

      // A location change reskins the world. The gate is deliberately NOT
      // touched: if it is down it stays down, so a real device never desyncs
      // because a child hopped to another state mid-crossing.
      CC.on('location', loc => this.show(loc));
      CC.on('train', () => buildConsist());
      // Closing the gate is what calls a train. Opening it never cancels one —
      // nothing the child does can go wrong.
      CC.on('gate', e => { if (e.state === 'closing') { idleTrainTimer = 1400; } });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { running = false; } else { start(); }
      });
      start();
    },

    /** Swap the backdrop. The gate is deliberately untouched: if it was down it
        stays down, right through the cross-fade, so a real device can never
        desync because a child hopped to another state mid-crossing. */
    show(loc, opts) {
      const next = mount(loc);
      if (!next || next === currentScene) return;
      const prev = currentScene;
      currentScene = next;
      clearSmoke();
      clearCars();
      buildConsist();
      setTrainVisible(train.active);
      // Put the arriving scene on top — it may have been mounted long ago and
      // be sitting underneath — then fade it in over the one being left, and
      // only switch the old one off once the fade is over. Fading both at once
      // would show the empty stage through the middle of the journey.
      stage.appendChild(next.svg);
      if (opts && opts.instant) {
        next.svg.classList.add('is-instant');
        next.svg.classList.add('is-on');
        requestAnimationFrame(() => next.svg.classList.remove('is-instant'));
      } else {
        next.svg.classList.remove('is-instant');
        // Make the browser notice the new scene at opacity 0 before we turn it
        // on, or the swap jumps instead of fading.
        void next.svg.getBoundingClientRect().width;
        next.svg.classList.add('is-on');
      }
      if (prev && prev !== next) {
        // ONLY THE CARS THE ENGINE MADE. This used to sweep every .cc-car out of
        // the scene being left, which is fine until a scene AUTHORS cars of its
        // own — Mystic parks five along the quay — because scenes are cached and
        // never rebuilt, so they would have gone for good the first time you
        // walked away. The engine's cars all live in the two groups the engine
        // itself inserted; nothing else is its to remove.
        [prev.carsFar, prev.carsNear].forEach(g => {
          if (g) while (g.firstChild) g.removeChild(g.firstChild);
        });
        setTimeout(() => { if (currentScene !== prev) prev.svg.classList.remove('is-on'); }, 480);
      }
      drawGates(performance.now());
    },

    /** Used by the customizer's Ride! button — send a train right now. */
    callTrain() { launchTrain(); },

    /** Test hook, the same idea as __setHead in tools/train-gallery.html: put
        the train exactly where you want it so a screenshot can catch it on the
        crossing instead of waiting for it to get there. Not used by the game. */
    __setTrain(x, dir) {
      if (!train.active) launchTrain();
      if (dir) train.dir = dir;
      train.head = x;
      placeTrain();
    },
  };

  CC.scene = scene;
})(window.CC = window.CC || {});
