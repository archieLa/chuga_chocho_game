/* rolling.js — turning a vehicle from CC.assets into a live, moving SVG group.

   Both the scene and the customizer need the same three things: build a vehicle,
   spin its wheels, and (for the steam engine) drive its side rods. That code
   lives here once so the little preview in the customizer and the big train on
   the hillside are literally the same machine.

   THE CONTRACTS (from CLAUDE.md "Train art") this module honours:
     · y = 0 is the rail line, +x is forward, vehicles face right.
     · Wheels are <g class="cc-wheel" data-cx data-cy data-r>; spin them with
       rotate(deg cx cy) where deg = distance / data-r in degrees. Radii differ
       per vehicle, so always read data-r.
     · Recolour hooks are .cc-loco .cc-wagon .cc-wagon2 .cc-roof .cc-trim .cc-brass,
       and recolouring is ALWAYS scoped to one vehicle's own root — never
       document.querySelectorAll, or every wagon changes colour together.
     · The steam valve gear is real crank geometry, not a canned loop.
*/
(function (CC) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const DEG = 180 / Math.PI;

  // Steam valve-gear constants — these live in the header of steam.svg and must
  // match it exactly, or the rods come away from the wheels.
  const SG = { DRIVER_R: 27, CRANK_R: 14, MAIN_ROD_L: 64, GUIDE_Y: -40, CYL_REAR: 138, CX: [0, 54, 108] };

  // Where a steam engine's chimney mouth is, in the engine's own coordinates.
  const STACK = { x: 134, y: -134 };

  const templates = {};        // type -> parsed <g>, cloned per instance

  function parseSvg(markup) {
    // DOMParser, never innerHTML: innerHTML on an SVG element loses the
    // namespace and the browser silently renders nothing.
    return new DOMParser().parseFromString(markup, 'image/svg+xml');
  }

  function template(type) {
    if (templates[type]) return templates[type];
    const markup = CC.assets && CC.assets.vehicles && CC.assets.vehicles[type];
    if (!markup) return null;
    const doc = parseSvg(markup);
    const g = document.createElementNS(NS, 'g');
    // Snapshot the child list first: importNode COPIES, it does not move, so
    // walking `firstChild` here would never terminate.
    Array.prototype.slice.call(doc.documentElement.childNodes)
      .forEach(node => g.appendChild(document.importNode(node, true)));
    templates[type] = g;
    return g;
  }

  /** Darken a #rrggbb by `amount` (0..1) — used so a double-stack container's
      second box reads as a shade of the colour the child picked, not a clash. */
  function shade(hex, amount) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
    if (!m) return hex;
    const p = m.slice(1).map(h => Math.round(parseInt(h, 16) * (1 - amount)));
    return '#' + p.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  }

  const rolling = {
    SG, STACK, DEG,

    /** Manifest entry: { file, kind, label, length, originFromRear }. */
    meta(type) {
      const m = CC.manifest && CC.manifest.vehicles;
      return (m && m[type]) || null;
    },

    isSteam(type) { return type === 'steam'; },

    /** A fresh <g> holding one vehicle, ready to be positioned and coloured. */
    build(type, colours) {
      const t = template(type);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'cc-vehicle');
      g.setAttribute('data-type', type);
      if (t) g.appendChild(t.cloneNode(true));
      if (colours) this.paint(g, colours);
      return g;
    },

    /** Recolour ONE vehicle. `root` is that vehicle's own group — this function
        never reaches outside it, which is what keeps three wagons three colours. */
    paint(root, colours) {
      if (!root || !colours) return;
      // A LIVERY IS A PAINT SCHEME, NOT A COLOUR. The vehicle carries the artwork
      // for it already and this only decides which one is showing — the base
      // colours that go with it arrive through `colours` like any other.
      root.querySelectorAll('.cc-livery').forEach(el => {
        el.setAttribute('display',
          el.getAttribute('data-livery') === colours.livery ? 'inline' : 'none');
      });
      Object.keys(colours).forEach(part => {
        const hex = colours[part];
        if (!hex || part === 'livery') return;
        root.querySelectorAll('.cc-' + part).forEach(el => el.setAttribute('fill', hex));
        // A container wagon carries a second box. Give it a darker shade of the
        // same colour unless the child has explicitly chosen one for it.
        if (part === 'wagon' && !colours.wagon2) {
          root.querySelectorAll('.cc-wagon2').forEach(el => el.setAttribute('fill', shade(hex, 0.22)));
        }
      });
    },

    /** Spin every wheel from the distance the vehicle has rolled (local units). */
    spin(root, dist) {
      root.querySelectorAll('.cc-wheel').forEach(w => {
        const cx = +w.dataset.cx, cy = +w.dataset.cy, r = +w.dataset.r;
        if (!r) return;
        w.setAttribute('transform', 'rotate(' + (dist / r * DEG).toFixed(2) + ' ' + cx + ' ' + cy + ')');
      });
    },

    /** Drive the steam engine's side rods from the same distance. Wheel angle,
        rods, crosshead and the chuff all come off this one number, which is why
        they stay locked together. */
    driveSteam(root, dist) {
      const th = dist / SG.DRIVER_R, deg = th * DEG;
      const q = sel => root.querySelector('[data-part="' + sel + '"]');
      const setLine = (el, a, b) => {
        if (!el) return;
        el.setAttribute('x1', a[0].toFixed(2)); el.setAttribute('y1', a[1].toFixed(2));
        el.setAttribute('x2', b[0].toFixed(2)); el.setAttribute('y2', b[1].toFixed(2));
      };
      SG.CX.forEach((cx, i) => {
        const d = q('driver-' + i);
        if (d) d.setAttribute('transform', 'rotate(' + deg.toFixed(3) + ' ' + cx + ' -27)');
      });
      const pin = cx => [cx + SG.CRANK_R * Math.cos(th), -27 + SG.CRANK_R * Math.sin(th)];
      const p0 = pin(SG.CX[0]), p1 = pin(SG.CX[1]), p2 = pin(SG.CX[2]);
      setLine(q('coupling-rod'), p0, p2);
      setLine(q('coupling-rod-hi'), p0, p2);
      const dy = p1[1] - SG.GUIDE_Y;
      const dx = Math.sqrt(Math.max(1, SG.MAIN_ROD_L * SG.MAIN_ROD_L - dy * dy));
      const xc = p1[0] + dx;
      setLine(q('main-rod'), [xc, SG.GUIDE_Y], p1);
      const ch = q('crosshead');
      if (ch) ch.setAttribute('x', (xc - 7).toFixed(2));
      setLine(q('piston-rod'), [SG.CYL_REAR, SG.GUIDE_Y], [xc, SG.GUIDE_Y]);
      [p0, p1, p2].forEach((p, i) => {
        const el = q('pin-' + i);
        if (el) { el.setAttribute('cx', p[0].toFixed(2)); el.setAttribute('cy', p[1].toFixed(2)); }
      });
    },

    /** Animate one vehicle group by how far it has rolled. */
    roll(root, dist, type) {
      this.spin(root, dist);
      if (this.isSteam(type || root.getAttribute('data-type'))) this.driveSteam(root, dist);
    },

    /** Which quarter-revolution the drivers are in. A two-cylinder engine chuffs
        four times per turn, so a change in this number is a chuff — and the same
        trigger emits a smoke puff, which is why sound and smoke stay in step. */
    chuffIndex(dist) { return Math.floor((dist / SG.DRIVER_R) / (Math.PI / 2)); },

    /** Lay a consist out from its front. Each vehicle's origin sits
        (length - originFromRear) behind its own front, so nothing is hard-coded:
        change a wagon's length in the manifest and the spacing follows.
        Returns [{ type, colours, offset, length }] with offsets <= 0. */
    layout(vehicles, gap) {
      const g = gap == null ? 8 : gap;
      let front = 0;
      return vehicles.map(v => {
        const m = this.meta(v.type) || { length: 250, originFromRear: 125 };
        const item = {
          type: v.type,
          colours: v.colours,
          slot: v.slot,
          length: m.length,
          offset: front - (m.length - m.originFromRear),
        };
        front -= (m.length + g);
        return item;
      });
    },

    /** Total length of a laid-out consist, in local units. */
    span(items, gap) {
      const g = gap == null ? 8 : gap;
      return items.reduce((sum, it) => sum + it.length + g, 0);
    },
  };

  CC.rolling = rolling;
})(window.CC = window.CC || {});
