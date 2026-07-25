/* scene.js — the SVG storybook renderer. See DESIGN.md §3 & §4.
   Owns the <svg id="scene"> element: draws the layered parallax background for the
   current location, the road + track, the two-sided crossing gate, the road cars,
   and the train. Animates via requestAnimationFrame.

   Phase 1.2: two gate arms meeting in the middle (+ crossbuck, flashing lights).
   Phase 1.3: replace this placeholder with real layered SVG art.
   Phase 1.4: render per-location scenery from CC.world.current.scenery.

   This stub just proves the loop + gate state are wired. It intentionally draws
   simple shapes; the art is the work.
*/
(function (CC) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  const scene = {
    svg: null,
    init() {
      this.svg = document.getElementById('scene');
      this.draw();               // static placeholder background
      requestAnimationFrame(this.loop.bind(this));
    },

    el(tag, attrs) {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    },

    draw() {
      const s = this.svg; if (!s) return;
      s.innerHTML = '';
      // placeholder ground + road + track so the shell isn't empty
      s.appendChild(this.el('rect', { x:0, y:430, width:1280, height:290, fill:'#7ac74f' }));      // grass
      s.appendChild(this.el('rect', { x:570, y:0, width:140, height:720, fill:'#5a5a5a' }));         // road
      s.appendChild(this.el('rect', { x:0, y:400, width:1280, height:60, fill:'#9a8366' }));         // track bed
      // gate arms group (updated each frame)
      this._arms = this.el('g', {});
      s.appendChild(this._arms);
    },

    // Draw the two gate arms based on CC.gate.angle (0 up .. 90 down).
    drawGate() {
      if (!this._arms) return;
      this._arms.innerHTML = '';
      const y = 452, len = 88, a = (CC.gate.angle / 90) * Math.PI / 2;
      [[490, 1], [790, -1]].forEach(([px, dir]) => {
        const tx = px + dir * Math.sin(a) * len;
        const ty = y - Math.cos(a) * len;
        this._arms.appendChild(this.el('line', { x1:px, y1:y, x2:tx, y2:ty, stroke:'#d62828', 'stroke-width':9, 'stroke-linecap':'round' }));
      });
    },

    loop(t) {
      const dt = 16;               // TODO: real delta timing
      CC.gate.tick(dt);
      this.drawGate();
      // TODO: cars, train, parallax, counter overlay
      requestAnimationFrame(this.loop.bind(this));
    },
  };

  CC.scene = scene;
})(window.CC = window.CC || {});
