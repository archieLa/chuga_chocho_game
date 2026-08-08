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
  function buildCar(colour, dir) {
    const g = el('g', { class: 'cc-car' });
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
    const roadPoly = svg.querySelector('.cc-road');
    if (roadPoly) {
      const ys = (roadPoly.getAttribute('points') || '').trim().split(/\s+/)
        .map(p => parseFloat(p.split(',')[1])).filter(v => !isNaN(v));
      if (ys.length) roadTop = Math.max(HORIZON, Math.min.apply(null, ys));
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
    [['.cc-el-train', 'data-run', 96], ['.cc-plane', 'data-fly', 58]].forEach(([sel, attr, speed]) => {
      [].forEach.call(svg.querySelectorAll(sel), node => {
        const v = (node.getAttribute(attr) || '').split(',').map(Number);
        if (v.length !== 3 || v.some(isNaN)) return;
        // data-fly / data-run is "from,to,y" — it STARTS at the first and heads
        // for the second, so the art can say which side it enters from.
        const lo = Math.min(v[0], v[1]), hi = Math.max(v[0], v[1]);
        shuttles.push({ el: node, x0: lo, x1: hi, y: v[2],
                        x: v[0], dir: v[1] > v[0] ? 1 : -1, speed: speed,
                        // Which way the ARTWORK points. +1 nose-right (the L),
                        // -1 nose-left (the plane). Mirror only when the two
                        // disagree, or it flies backwards.
                        nose: parseFloat(node.getAttribute('data-nose')) || 1,
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
      const v = (exitEl.getAttribute('data-exit') || '').split(',').map(Number);
      if (v.length === 3 && !v.some(isNaN)) {
        roadExit = {
          y0: v[0], y1: v[1], jx: v[2],
          // Pushed to the outer thirds so the two streams clear each other: a car
          // is ~24px tall here and the band is 56px, so 0.75/0.25 leaves a full
          // car's height between them.
          laneOut: v[0] + (v[1] - v[0]) * 0.75,   // outbound keeps the near lane
          laneIn: v[0] + (v[1] - v[0]) * 0.25,    // inbound the far one
          toX: 1340,
        };
      }
    }

    // An ambient train on a curved line drawn into the scene — Horseshoe Curve
    // exports #curve-path, the centreline of the near running road. This is
    // scenery, NOT the gameplay train: it loops for ever and the gate has no
    // opinion about it, because it never touches the crossing.
    const curve = buildCurveTrain(svg);

    const s = { id: loc.id, svg: svg, arms: arms, lamps: lamps, sceneryTrains: sceneryTrains,
                roadTop: roadTop, roadExit: roadExit, curve: curve, cablecars: cablecars, rocket: rocket,
                ferris: ferris, shuttles: shuttles,
                trainG: trainG, smokeG: smokeG, carsFar: carsFar, carsNear: carsNear };
    mounted[loc.id] = s;
    stage.appendChild(svg);
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
      if (facing !== s.nose) tr += ' scale(-1,1)';
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

  function buildConsist() {
    train.els = [];
    if (!currentScene) return;
    currentScene.trainG.textContent = '';
    train.items = CC.rolling.layout(CC.trains.vehicles(), GAP);
    train.span = CC.rolling.span(train.items, GAP) * TRAIN_S;
    train.items.forEach(item => {
      const g = CC.rolling.build(item.type, item.colours);   // colours scoped to THIS vehicle
      currentScene.trainG.appendChild(g);
      train.els.push(g);
    });
    placeTrain();
  }

  function placeTrain() {
    const dir = train.dir;
    const dist = (dir > 0 ? train.head : -train.head) / TRAIN_S;
    train.items.forEach((item, i) => {
      const g = train.els[i];
      if (!g) return;
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
    train.head = train.dir > 0 ? -(420) : W + 420;
    train.active = true;
    train.whistled = false;
    train.lastChuff = CC.rolling.chuffIndex((train.dir > 0 ? train.head : -train.head) / TRAIN_S);
    CC.audio.whistle();
    setTrainVisible(true);
  }

  function setTrainVisible(on) {
    train.els.forEach(g => g.setAttribute('visibility', on ? 'visible' : 'hidden'));
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
    train.head += train.dir * TRAIN_SPEED * dt / 1000;
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
    if (done) { train.active = false; setTrainVisible(false); idleTrainTimer = 0; }
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
    const at = down ? top + 4 : H + 120;
    // Where the road turns, traffic coming toward us has driven in along the side
    // road rather than materialising at the end of ours.
    if (down && ex) {
      const car = newCar(1, ex.laneIn);
      car.phase = 'enter';
      car.x = ex.toX;
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
    const x = car.x != null ? car.x : ROAD_CX + (car.dir > 0 ? -half * 0.5 : half * 0.5);
    const s = depthScale(car.y);
    // A car sprite is drawn nose-up/nose-down for a vertical carriageway. On the
    // side road it is travelling across the picture, so it has to be turned a
    // quarter. Both directions want the SAME +90: an outbound car carries a
    // nose-up sprite and ends up pointing east, an inbound one carries nose-down
    // and ends up pointing west, which is exactly right.
    const turn = car.phase === 'road' ? '' : ' rotate(90)';
    car.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + car.y.toFixed(1) + ')' + turn + ' scale(' + s.toFixed(3) + ')');
    // Fade over the last stretch before the road's far end. At the horizon a car
    // is tiny and this is invisible; on a truncated road it is what stops a
    // still-sizeable car from popping out of existence in mid-picture.
    const top = currentScene ? currentScene.roadTop : HORIZON;
    // Fade only applies to the carriageway. A car that has turned onto the side
    // road sits just above the road's end by y, and would otherwise be dimmed
    // for its whole run along a road it is legitimately driving on.
    car.el.setAttribute('opacity',
      car.phase === 'road' ? clamp((car.y - top) / CAR_FADE, 0, 1).toFixed(2) : '1');
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
  function driveSideRoad(car, secs) {
    const ex = currentScene && currentScene.roadExit;
    if (!ex) return false;

    if (car.phase === 'exit') {
      car.x += car.speed * depthScale(car.y) * secs;
      if (car.x > ex.toX) car.dead = true;
      return true;
    }
    if (car.phase === 'enter') {
      car.x -= car.speed * depthScale(car.y) * secs;
      // Reached the junction: swing onto our carriageway and head down.
      if (car.x <= ex.jx + 16) { car.phase = 'road'; car.x = null; car.y = ex.y1; }
      return true;
    }
    // Going away from the viewer and has reached the junction: turn right.
    if (car.dir < 0 && car.y <= ex.y1) {
      car.phase = 'exit';
      car.y = ex.laneOut;
      car.x = ROAD_CX + roadHalf(car.y) * 0.5;
      return true;
    }
    return false;
  }

  function updateCars(dt) {
    const blocked = CC.gate.isBlocking() || trainOnCrossing();
    const secs = dt / 1000;

    // Each lane is a queue. Walk it from the front so every car knows what it
    // has to stop behind — the gate for the leader, the car ahead for the rest.
    // Side-road traffic first: a car that has turned off is no longer part of
    // the carriageway queue and must not be given a stop line on it.
    cars.forEach(car => { car.offRoad = driveSideRoad(car, secs); });
    // Rim Drive is a queue too. Without this, two cars released together at the
    // gate turn together and then sit 7px apart the whole way across.
    ['exit', 'enter'].forEach(ph => {
      const lane = cars.filter(c => c.phase === ph)
        .sort((a, b) => ph === 'exit' ? b.x - a.x : a.x - b.x);   // front first
      let limit = null;
      lane.forEach(c => {
        const gap = 150 * depthScale(c.y);
        if (limit != null) c.x = ph === 'exit' ? Math.min(c.x, limit) : Math.max(c.x, limit);
        limit = ph === 'exit' ? c.x - gap : c.x + gap;
      });
    });

    [1, -1].forEach(dir => {
      const lane = cars.filter(c => c.dir === dir && c.phase === 'road')
        .sort((a, b) => dir > 0 ? b.y - a.y : a.y - b.y);   // front of the queue first
      const stopLine = dir > 0 ? STOP_FAR : STOP_NEAR;
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
        if (limit != null) want = dir > 0 ? Math.min(want, limit) : Math.max(want, limit);
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
      const top = currentScene ? currentScene.roadTop : HORIZON;
      if (car.dead || car.y < top || car.y > H + 170) {
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
        prev.svg.querySelectorAll('.cc-car').forEach(c => c.parentNode.removeChild(c));
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
