#!/usr/bin/env python3
"""Build train-gallery.html — inspect every locomotive and wagon, and run consists
across the Colorado scene. Self-contained (everything inlined) so it opens from file://."""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TRAINS = ROOT / 'play/assets/trains'
manifest = json.loads((TRAINS / 'manifest.json').read_text())['vehicles']

# ids we rename to data-part so multiple copies can coexist without id clashes.
ANIM_IDS = ['driver-0', 'driver-1', 'driver-2', 'coupling-rod', 'coupling-rod-hi',
            'main-rod', 'piston-rod', 'crosshead', 'pin-0', 'pin-1', 'pin-2']


def parts(path):
    s = (TRAINS / path).read_text()
    s = re.sub(r'<\?xml[^>]*\?>', '', s)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    inner = re.search(r'<svg[^>]*>(.*)</svg>', s, flags=re.S).group(1)
    for i in ANIM_IDS:
        inner = inner.replace(f'id="{i}"', f'data-part="{i}"')
    return vb, inner


ORDER = ['steam', 'diesel', 'electric-hs', 'commuter', 'streetcar', 'cable-car',
         'wagon-coach-old', 'wagon-caboose', 'wagon-coach-modern', 'wagon-hs-coach',
         'wagon-boxcar', 'wagon-tanker', 'wagon-hopper', 'wagon-container']

cards = []
for key in ORDER:
    v = manifest[key]
    vb, inner = parts(v['file'])
    x0, y0, w, h = (float(t) for t in vb.split())
    track = (f'<rect x="{x0}" y="0" width="{w}" height="15" fill="#a98c68"/>'
             + ''.join(f'<rect x="{x0 + 6 + i*26}" y="1" width="10" height="13" fill="#6b4a2a"/>'
                       for i in range(int(w // 26)))
             + f'<rect x="{x0}" y="-2" width="{w}" height="4" fill="#d3d7dc"/>')
    cards.append(
        f'<figure class="card" data-kind="{v["kind"]}">'
        f'<figcaption><b>{v["label"]}</b><span>{key} · {v["length"]}u</span></figcaption>'
        f'<svg class="veh" viewBox="{vb}" xmlns="http://www.w3.org/2000/svg">{track}{inner}</svg>'
        f'</figure>')

# --- Colorado scene for the consist stage ---
scene = (ROOT / 'play/assets/scenes/colorado.svg').read_text()
scene = re.sub(r'<\?xml[^>]*\?>', '', scene)
scene = re.sub(r'<!--.*?-->', '', scene, flags=re.S)
scene_inner = re.search(r'<svg[^>]*>(.*)</svg>', scene, flags=re.S).group(1)
before, after = scene_inner.split('<g id="scenery-front">', 1)
after = '<g id="scenery-front">' + after

# every vehicle, ready to be cloned into a consist
defs_pool = ''.join(
    f'<g class="pool" data-veh="{k}" data-vb="{parts(manifest[k]["file"])[0]}">'
    f'{parts(manifest[k]["file"])[1]}</g>' for k in ORDER)

PRESETS = [
    ('Colorado steam', ['steam', 'wagon-coach-old', 'wagon-caboose']),
    ('UP freight', ['diesel', 'wagon-container', 'wagon-tanker', 'wagon-hopper']),
    ('Euro high-speed', ['electric-hs', 'wagon-hs-coach', 'wagon-hs-coach']),
    ('City commuter', ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('Mixed freight', ['diesel', 'wagon-boxcar', 'wagon-hopper', 'wagon-caboose']),
    ('New Orleans streetcar', ['streetcar', 'streetcar']),
    ('SF cable car', ['cable-car', 'cable-car']),
]
preset_btns = ''.join(
    f'<button class="preset" data-i="{i}">{n}</button>' for i, (n, _) in enumerate(PRESETS))

TPL = r"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chuga Chocho — rolling stock</title>
<style>
  :root{ --bg:#11151b; --panel:#1b212a; --ink:#e8eef5; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:'Trebuchet MS',system-ui,sans-serif;padding:20px 16px 60px}
  h1{font-size:1.4rem;margin:0 0 4px;text-align:center}
  h2{font-size:1rem;font-weight:normal;opacity:.6;margin:34px 0 12px;text-align:center;
     letter-spacing:.14em;text-transform:uppercase}
  .sub{text-align:center;opacity:.6;font-size:.9rem;margin:0 0 18px}
  .bar{position:sticky;top:0;z-index:9;display:flex;gap:14px;flex-wrap:wrap;
    justify-content:center;align-items:center;background:var(--panel);
    padding:11px 18px;border-radius:999px;margin:0 auto 8px;width:fit-content;
    box-shadow:0 6px 20px rgba(0,0,0,.45)}
  .bar label{font-size:.85rem;opacity:.85;display:flex;align-items:center;gap:7px}
  input[type=range]{width:150px}
  input[type=color]{width:34px;height:26px;border:none;background:none;cursor:pointer;padding:0}
  button{border:none;background:#3d7bd6;color:#fff;font-weight:bold;padding:.45rem 1rem;
    border-radius:999px;cursor:pointer;font-size:.85rem}
  button.alt{background:#4a515b}
  button.preset{background:#2f3742;font-weight:normal}
  button.preset.on{background:#3d7bd6;font-weight:bold}
  .grid{display:grid;gap:14px;grid-template-columns:1fr;max-width:1180px;margin:0 auto}
  @media(min-width:900px){.grid{grid-template-columns:1fr 1fr}}
  .card{margin:0;background:#20262f;
    border-radius:14px;padding:10px 12px 4px;box-shadow:0 4px 16px rgba(0,0,0,.35)}
  figcaption{display:flex;justify-content:space-between;align-items:baseline;
    font-size:.86rem;margin-bottom:2px}
  figcaption span{opacity:.45;font-size:.75rem}
  svg.veh{display:block;width:100%;height:auto}
  .stage{max-width:1280px;margin:0 auto;border-radius:14px;overflow:hidden;
    box-shadow:0 10px 40px rgba(0,0,0,.5)}
  .stage svg{display:block;width:100%;height:auto}
  .presets{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:12px auto}
  .hint{opacity:.5;font-size:.8rem;text-align:center;max-width:70ch;margin:10px auto;line-height:1.6}
</style></head>
<body>

<h1>🚂 Chuga Chocho — rolling stock</h1>
<p class="sub">Every wheel turns. Steam side rods run on real crank geometry.</p>

<div class="bar">
  <button id="playBtn">⏸ Pause</button>
  <label>Speed <input type="range" id="speed" min="0" max="6" step="0.05" value="2"></label>
  <button class="alt" id="stepBtn">Step ▸</button>
  <label>Loco <input type="color" id="cLoco" value="#1c1f26"></label>
  <label>Wagon <input type="color" id="cWagon" value="#1f4d3a"></label>
  <label>Trim <input type="color" id="cTrim" value="#c0392b"></label>
  <button class="alt" id="resetBtn">Reset colours</button>
</div>

<h2>Build a train</h2>
<div class="presets">__PRESET_BTNS__</div>
<div class="stage">
  <svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    __BEFORE__
    <g id="smoke"></g>
    <g id="consist"></g>
    __AFTER__
  </svg>
</div>
<p class="hint">Consists are assembled from the manifest — each vehicle knows its own length,
so wagons butt up behind the locomotive automatically.</p>

<h2>Catalogue</h2>
<div class="grid">__CARDS__</div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs></defs>__POOL__</svg>

<script>
const SVGNS = 'http://www.w3.org/2000/svg';
const MANIFEST = __MANIFEST__;
const PRESETS = __PRESETS__;
const DEG = 180 / Math.PI;

/* ---------- steam valve gear (same maths as the locomotive asset) ---------- */
const SG = { DRIVER_R:27, CRANK_R:14, MAIN_ROD_L:64, GUIDE_Y:-40, CYL_REAR:138, CX:[0,54,108] };
function setLine(el,a,b){ if(!el) return;
  el.setAttribute('x1',a[0]); el.setAttribute('y1',a[1]);
  el.setAttribute('x2',b[0]); el.setAttribute('y2',b[1]); }

function driveSteam(root, dist){
  const th = dist / SG.DRIVER_R, deg = th * DEG;
  SG.CX.forEach((cx,i) => {
    const d = root.querySelector('[data-part="driver-'+i+'"]');
    if (d) d.setAttribute('transform', `rotate(${deg.toFixed(3)} ${cx} -27)`);
  });
  const pin = cx => [cx + SG.CRANK_R*Math.cos(th), -27 + SG.CRANK_R*Math.sin(th)];
  const p0=pin(SG.CX[0]), p1=pin(SG.CX[1]), p2=pin(SG.CX[2]);
  setLine(root.querySelector('[data-part="coupling-rod"]'), p0, p2);
  setLine(root.querySelector('[data-part="coupling-rod-hi"]'), p0, p2);
  const dy = p1[1]-SG.GUIDE_Y;
  const dx = Math.sqrt(Math.max(1, SG.MAIN_ROD_L*SG.MAIN_ROD_L - dy*dy));
  const xc = p1[0]+dx;
  setLine(root.querySelector('[data-part="main-rod"]'), [xc,SG.GUIDE_Y], p1);
  const ch = root.querySelector('[data-part="crosshead"]');
  if (ch) ch.setAttribute('x', (xc-7).toFixed(2));
  setLine(root.querySelector('[data-part="piston-rod"]'), [SG.CYL_REAR,SG.GUIDE_Y], [xc,SG.GUIDE_Y]);
  [p0,p1,p2].forEach((p,i) => {
    const el = root.querySelector('[data-part="pin-'+i+'"]');
    if (el){ el.setAttribute('cx',p[0]); el.setAttribute('cy',p[1]); }
  });
}

/* ---------- generic wheels: every .cc-wheel spins from its own radius ---------- */
function spin(root, dist){
  root.querySelectorAll('.cc-wheel').forEach(w => {
    const cx = +w.dataset.cx, cy = +w.dataset.cy, r = +w.dataset.r;
    w.setAttribute('transform', `rotate(${(dist / r * DEG).toFixed(2)} ${cx} ${cy})`);
  });
}

/* ---------- consist assembly ---------- */
const consistEl = document.getElementById('consist');
const smokeEl = document.getElementById('smoke');
const CONSIST_S = 0.55, RAIL_Y = 500, GAP = 8;
let consist = [], puffs = [], lastChuff = 0, headX = -200;

function buildConsist(list){
  consistEl.innerHTML = ''; consist = [];
  puffs.forEach(p => p.el.remove()); puffs = [];
  let frontLocal = 0;                       // running position, local units
  list.forEach(key => {
    const m = MANIFEST[key];
    const src = document.querySelector(`.pool[data-veh="${key}"]`);
    const g = document.createElementNS(SVGNS, 'g');
    g.innerHTML = src.innerHTML;
    consistEl.appendChild(g);
    // local origin sits (length - originFromRear) behind the vehicle's front
    consist.push({ key, g, offset: frontLocal - (m.length - m.originFromRear), isSteam: key === 'steam' });
    frontLocal -= (m.length + GAP);
  });
  applyColours();
  layout();
}

function layout(){
  const dist = headX / CONSIST_S;
  consist.forEach(v => {
    const x = headX + v.offset * CONSIST_S;
    v.g.setAttribute('transform', `translate(${x.toFixed(2)},${RAIL_Y}) scale(${CONSIST_S})`);
    spin(v.g, dist);
    if (v.isSteam) driveSteam(v.g, dist);
  });
}

/* ---------- steam chuff smoke (4 per wheel revolution) ---------- */
function emitPuff(){
  const head = consist[0]; if (!head || !head.isSteam) return;
  const c = document.createElementNS(SVGNS,'circle');
  c.setAttribute('fill','#fff'); smokeEl.appendChild(c);
  puffs.push({ x: headX + (head.offset + 134) * CONSIST_S,
               y: RAIL_Y - 134 * CONSIST_S, r: 4, o: 0.8, el: c });
  if (puffs.length > 44){ puffs.shift().el.remove(); }
}
function updateSmoke(){
  for (let i = puffs.length - 1; i >= 0; i--){
    const p = puffs[i];
    p.y -= 0.5; p.x -= 0.22; p.r += 0.3; p.o -= 0.009;
    if (p.o <= 0){ p.el.remove(); puffs.splice(i,1); continue; }
    p.el.setAttribute('cx',p.x.toFixed(1)); p.el.setAttribute('cy',p.y.toFixed(1));
    p.el.setAttribute('r',p.r.toFixed(1)); p.el.setAttribute('opacity',p.o.toFixed(3));
  }
}

/* ---------- catalogue rows ---------- */
const cards = [...document.querySelectorAll('svg.veh')];
let catDist = 0;

/* ---------- main loop ---------- */
let running = true;
const speedEl = document.getElementById('speed');
function frame(){
  if (running){
    const v = parseFloat(speedEl.value);
    catDist += v / 0.6;
    cards.forEach(c => { spin(c, catDist); if (c.querySelector('[data-part="driver-0"]')) driveSteam(c, catDist); });
    headX += v;
    if (headX > 1700){ headX = -900; puffs.forEach(p => p.el.remove()); puffs = []; }
    layout();
    const th = (headX / CONSIST_S) / SG.DRIVER_R;
    const ch = Math.floor(th / (Math.PI/2));
    if (ch !== lastChuff){ lastChuff = ch; emitPuff(); }
    updateSmoke();
  }
  requestAnimationFrame(frame);
}

/* ---------- colours ---------- */
const DEFAULTS = new WeakMap();
function rememberDefaults(){
  document.querySelectorAll('[class*="cc-"]').forEach(el => {
    if (!DEFAULTS.has(el)) DEFAULTS.set(el, el.getAttribute('fill'));
  });
}
function applyColours(){
  rememberDefaults();
  const L = document.getElementById('cLoco').value;
  const W = document.getElementById('cWagon').value;
  const T = document.getElementById('cTrim').value;
  if (locoOn) document.querySelectorAll('.cc-loco').forEach(e => e.setAttribute('fill', L));
  if (wagonOn) document.querySelectorAll('.cc-wagon').forEach(e => e.setAttribute('fill', W));
  if (trimOn) document.querySelectorAll('.cc-trim').forEach(e => e.setAttribute('fill', T));
}
let locoOn = false, wagonOn = false, trimOn = false;
document.getElementById('cLoco').addEventListener('input', () => { locoOn = true; applyColours(); });
document.getElementById('cWagon').addEventListener('input', () => { wagonOn = true; applyColours(); });
document.getElementById('cTrim').addEventListener('input', () => { trimOn = true; applyColours(); });
document.getElementById('resetBtn').addEventListener('click', () => {
  locoOn = wagonOn = trimOn = false;
  document.querySelectorAll('[class*="cc-"]').forEach(el => {
    const d = DEFAULTS.get(el); if (d != null) el.setAttribute('fill', d);
  });
});

/* ---------- controls ---------- */
document.getElementById('playBtn').addEventListener('click', e => {
  running = !running; e.target.textContent = running ? '⏸ Pause' : '▶ Play';
});
document.getElementById('stepBtn').addEventListener('click', () => {
  catDist += 4; headX += 3;
  cards.forEach(c => { spin(c, catDist); if (c.querySelector('[data-part="driver-0"]')) driveSteam(c, catDist); });
  layout();
});
document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.preset').forEach(o => o.classList.remove('on'));
  b.classList.add('on');
  headX = -900; lastChuff = 0;
  buildConsist(PRESETS[+b.dataset.i][1]);
}));

rememberDefaults();
document.querySelector('.preset').classList.add('on');
buildConsist(PRESETS[0][1]);
requestAnimationFrame(frame);
window.__pause = () => { running = false; };
window.__setHead = v => { headX = v; layout(); };
</script>
</body></html>
"""

html = (TPL
  .replace('__CARDS__', ''.join(cards))
  .replace('__BEFORE__', before)
  .replace('__AFTER__', after)
  .replace('__POOL__', defs_pool)
  .replace('__PRESET_BTNS__', preset_btns)
  .replace('__MANIFEST__', json.dumps(manifest))
  .replace('__PRESETS__', json.dumps([[n, l] for n, l in PRESETS])))
out = pathlib.Path(__file__).resolve().parent / 'train-gallery.html'
out.write_text(html)
print('wrote', out, len(html) // 1024, 'KB')
