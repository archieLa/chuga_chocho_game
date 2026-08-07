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
    const roadPoly = svg.querySelector('#road polygon');
    if (roadPoly) {
      const ys = (roadPoly.getAttribute('points') || '').trim().split(/\s+/)
        .map(p => parseFloat(p.split(',')[1])).filter(v => !isNaN(v));
      if (ys.length) roadTop = Math.max(HORIZON, Math.min.apply(null, ys));
    }

    // An ambient train on a curved line drawn into the scene — Horseshoe Curve
    // exports #curve-path, the centreline of the near running road. This is
    // scenery, NOT the gameplay train: it loops for ever and the gate has no
    // opinion about it, because it never touches the crossing.
    const curve = buildCurveTrain(svg);

    const s = { id: loc.id, svg: svg, arms: arms, lamps: lamps, sceneryTrains: sceneryTrains,
                roadTop: roadTop, curve: curve,
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
  const CURVE = {
    consist: [{ type: 'diesel',       colours: { loco: '#2f4c72', trim: '#c8a23a' } },
              { type: 'wagon-hopper', colours: { wagon: '#6b6f76' } },
              { type: 'wagon-hopper', colours: { wagon: '#7c5a3a' } },
              { type: 'wagon-hopper', colours: { wagon: '#6b6f76' } }],
    speed: 46,            // local units per second — a slow freight, far away
    base: 0.36,           // multiplies the art's own depth rule (see depthAt)
    gap: 8,
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

    const items = CC.rolling.layout(CURVE.consist, CURVE.gap);
    const cars = items.map(it => {
      const g = CC.rolling.build(it.type, it.colours);
      holder.appendChild(g);
      return { el: g, type: it.type, offset: it.offset };
    });
    return { path: path, total: total, cars: cars, dist: 0,
             span: CC.rolling.span(items, CURVE.gap) };
  }

  function updateCurveTrain(dt) {
    const c = currentScene && currentScene.curve;
    if (!c) return;
    c.dist += CURVE.speed * (dt / 1000);
    // Loop with the whole consist clear of the start, so it re-enters rather
    // than blinking back into the middle of the bowl.
    const lap = c.total + c.span * CURVE.base;
    if (c.dist > lap) c.dist -= lap;

    c.cars.forEach(car => {
      // offset is <= 0 (measured back from the front of the train).
      let at = c.dist + car.offset * CURVE.base;
      const on = at >= 0 && at <= c.total;
      car.el.setAttribute('opacity', on ? '1' : '0');
      if (!on) return;
      const p = c.path.getPointAtLength(at);
      // Heading from a nearby second sample — atan2 of the difference. Sampling
      // forward near the end would clamp and give a heading of zero, so step
      // backwards there instead.
      const ahead = Math.min(at + 6, c.total);
      const back = Math.max(at - 6, 0);
      const a = c.path.getPointAtLength(back), b = c.path.getPointAtLength(ahead);
      const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      const s = Math.max(0.05, curveDepth(p.y));
      car.el.setAttribute('transform',
        'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') rotate(' + deg.toFixed(1) + ') scale(' + s.toFixed(3) + ')');
      CC.rolling.roll(car.el, c.dist / CURVE.base, car.type);
    });
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
    const at = down ? top + 4 : H + 120;
    // Don't drop a car on top of one that has not got clear of the entrance yet.
    if (cars.some(c => c.dir === (down ? 1 : -1) && Math.abs(c.y - at) < carGap(at) * 1.2)) return;
    const car = {
      dir: down ? 1 : -1,
      y: at,
      colour: CAR_COLOURS[(Math.random() * CAR_COLOURS.length) | 0],
      speed: 150 + Math.random() * 40,                 // world speed; screen speed scales with depth
      stopped: false,
      counted: false,
      near: null,
    };
    car.el = buildCar(car.colour, car.dir);
    cars.push(car);
    placeCar(car);
  }

  function placeCar(car) {
    // Traffic keeps right: cars coming toward us use the left half of the road.
    const half = roadHalf(car.y);
    const x = ROAD_CX + (car.dir > 0 ? -half * 0.5 : half * 0.5);
    const s = depthScale(car.y);
    car.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + car.y.toFixed(1) + ') scale(' + s.toFixed(3) + ')');
    // Fade over the last stretch before the road's far end. At the horizon a car
    // is tiny and this is invisible; on a truncated road it is what stops a
    // still-sizeable car from popping out of existence in mid-picture.
    const top = currentScene ? currentScene.roadTop : HORIZON;
    car.el.setAttribute('opacity', clamp((car.y - top) / CAR_FADE, 0, 1).toFixed(2));
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

  function updateCars(dt) {
    const blocked = CC.gate.isBlocking() || trainOnCrossing();
    const secs = dt / 1000;

    // Each lane is a queue. Walk it from the front so every car knows what it
    // has to stop behind — the gate for the leader, the car ahead for the rest.
    [1, -1].forEach(dir => {
      const lane = cars.filter(c => c.dir === dir)
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
      if (car.y < top || car.y > H + 170) {
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
