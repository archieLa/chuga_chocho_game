#!/usr/bin/env python3
"""Build scene-gallery.html — every location scene with its train running through it.
Self-contained (scenes + rolling stock inlined) so it opens straight from disk."""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCENES = ROOT / 'play/assets/scenes'
TRAINS = ROOT / 'play/assets/trains'
manifest = json.loads((TRAINS / 'manifest.json').read_text())['vehicles']

ANIM_IDS = ['driver-0', 'driver-1', 'driver-2', 'coupling-rod', 'coupling-rod-hi',
            'main-rod', 'piston-rod', 'crosshead', 'pin-0', 'pin-1', 'pin-2']

# scene id -> (State, Destination, hero, consist). Engines match world.js presets.
CATALOGUE = [
    ('colorado',     'Colorado',   'Rocky Mountains', 'Georgetown Loop trestle, aspens, Clear Creek',
     ['steam', 'wagon-coach-old', 'wagon-caboose']),
    ('sf',           'California', 'San Francisco',   'Bay under the Golden Gate, waterfront park, Painted Ladies',
     ['cable-car', 'cable-car']),
    ('la',           'California', 'Los Angeles',     'The Pacific, Muscle Beach, volleyball, HOLLYWOOD on the hills',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('chicago',      'Illinois',   'Chicago',         'Skyline, the L, Navy Pier and the Centennial Wheel',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('grand-canyon', 'Arizona',    'Grand Canyon',    'The void, the Colorado far below, the Watchtower on the rim trail',
     ['diesel', 'wagon-coach-old', 'wagon-coach-old']),
    ('nyc',          'New York',   'New York City',   'Brooklyn Bridge, the full skyline, brownstones and walk-ups',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('seattle',      'Washington', 'Seattle',         'Space Needle over houseboats, Mount Rainier, evergreens',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('new-orleans',  'Louisiana',  'New Orleans',     'French Quarter balconies, streetcar, live oaks',
     ['streetcar', 'streetcar']),
    ('austin',       'Texas',      'Austin',          'A million bats off the Congress Avenue Bridge at sunset',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('houston',      'Texas',      'Houston',         'The shuttle Independence riding a 747, a Saturn V on its side',
     ['diesel', 'wagon-tanker', 'wagon-tanker']),
    ('cape-canaveral','Florida',   'Cape Canaveral',  'A rocket off Pad 39, the VAB, saltmarsh and a gator',
     ['diesel', 'wagon-boxcar', 'wagon-boxcar']),
    ('oahu',         'Hawaii',     'Oʻahu',           'Diamond Head over the Waikīkī reef, outriggers, the Duke, hula',
     ['cane-tank', 'wagon-cane', 'wagon-cane']),
    ('denali',       'Alaska',     'Denali',          'The Alaska Range from the Susitna flats, aurora over a spruce valley',
     ['diesel', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('las-vegas',    'Nevada',     'Las Vegas',       'The Strip after dark, neon pooling on wet asphalt',
     ['monorail', 'wagon-monorail', 'wagon-monorail']),
    ('moab',         'Utah',       'Moab',            'Delicate Arch from the slickrock, the La Sals behind',
     ['diesel', 'wagon-boxcar', 'wagon-hopper']),
    ('nashville',    'Tennessee',  'Nashville',       'Lower Broadway, honky tonk neon, late afternoon',
     ['diesel', 'wagon-coach-modern', 'wagon-caboose']),
    ('boston',       'Massachusetts', 'Boston',       'Back Bay across the Charles, early autumn',
     ['streetcar', 'wagon-coach-old', 'wagon-coach-old']),
    ('yellowstone',  'Wyoming',    'Yellowstone',     'The Upper Geyser Basin, bison on the sinter flat',
     ['steam', 'wagon-coach-old', 'wagon-caboose']),
    ('washington-dc', 'District of Columbia', 'Washington', 'The Tidal Basin at cherry blossom',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('miami-beach',  'Florida',    'Miami Beach',     'Ocean Drive, Deco pastels and the candy towers',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('duluth',       'Minnesota',  'Duluth',          'The Aerial Lift Bridge over the ship canal',
     ['diesel', 'wagon-hopper', 'wagon-boxcar']),
    ('kansas',       'Kansas',     'Wheat Country',   'The elevator on the siding, and all that sky',
     ['diesel', 'wagon-hopper', 'wagon-hopper']),
    ('kansas-city',  'Missouri',   'Kansas City',     'Union Station from the Liberty Memorial lawn',
     ['diesel', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('smokies',      'Tennessee',  'Gatlinburg',      'The layered ridges above the Parkway',
     ['steam', 'wagon-coach-old', 'wagon-caboose']),
    ('horseshoe-curve', 'Pennsylvania', 'Horseshoe Curve',
     'The line thrown round the head of the valley',
     ['diesel', 'wagon-boxcar', 'wagon-hopper']),
    ('crater-lake',  'Oregon',     'Crater Lake',     'The caldera and Wizard Island from Rim Drive',
     ['commuter', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('bluegrass',    'Kentucky',   'Bluegrass',       'White board fence, a show barn and thoroughbreds',
     ['steam', 'wagon-coach-old', 'wagon-caboose']),
    ('mt-washington', 'New Hampshire', 'Mount Washington',
     'The Cog Railway climbing from Marshfield',
     ['steam', 'wagon-coach-old', 'wagon-caboose']),
    ('cedar-point',  'Ohio',       'Cedar Point',     'The midway and the park railroad, under the coasters',
     ['steam', 'wagon-coach-old', 'wagon-coach-old']),
    ('savannah',     'Georgia',    'Savannah',        'A historic square under the live oaks and Spanish moss',
     ['streetcar', 'wagon-coach-old', 'wagon-coach-old']),
    ('stonington',   'Maine',      'Stonington',      'The town landing on Deer Isle, and the lobster fleet',
     ['diesel', 'wagon-boxcar', 'wagon-caboose']),
    ('albuquerque',  'New Mexico', 'Albuquerque',     'The mass ascension over the Rio Grande, the Sandias behind',
     ['diesel', 'wagon-boxcar', 'wagon-hopper']),
    ('cape-hatteras', 'North Carolina', 'Cape Hatteras',
     'The lighthouse behind the dunes, the Atlantic beyond',
     ['diesel', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('quechee',      'Vermont',    'Quechee',         'The mill and the falls under a hillside in October',
     ['steam', 'wagon-coach-old', 'wagon-caboose']),
    ('detroit',      'Michigan',   'Detroit',         'The assembly plant, the shipping lot and the city behind',
     ['diesel', 'wagon-boxcar', 'wagon-boxcar']),
    ('sun-valley',   'Idaho',      'Sun Valley',      'Bald Mountain, the gondola and Ketchum in the snow',
     ['diesel', 'wagon-coach-modern', 'wagon-coach-modern']),
    ('indianapolis', 'Indiana',    'Indianapolis',    'The main straight, the pit lane and the yard of bricks',
     ['diesel', 'wagon-boxcar', 'wagon-caboose']),
]


def strip(svg):
    s = re.sub(r'<\?xml[^>]*\?>', '', svg)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    return re.search(r'<svg[^>]*>(.*)</svg>', s, flags=re.S).group(1)


def veh_inner(key):
    s = strip((TRAINS / manifest[key]['file']).read_text())
    for i in ANIM_IDS:
        s = s.replace(f'id="{i}"', f'data-part="{i}"')
    return s


# Scene defs use the same ids in every file (skyg, sung, grassg...). Namespace them
# per scene so eight inlined scenes don't fight over one id.
# Namespace the DEFINITION, never a bare id="…". 'water' is both a gradient name (in
# Colorado) and a layer name (in every scene) — a blind id="water" rewrite renamed the
# layer too, which silently breaks anything looking layers up by id.
def namespace(inner, sid):
    for gid in ['skyg', 'sung', 'grassg', 'roadg', 'bay', 'lake', 'water', 'stream', 'river', 'pave', 'sand', 'ocean', 'asphalt', 'sound', 'wetst', 'bay', 'park', 'boilerShade', 'aurora', 'aurora2', 'lasal', 'glass', 'hancock', 'charles', 'sinter', 'prism', 'basin', 'ocean', 'conc', 'stone', 'superior', 'canalw', 'creekw', 'creekclip', 'pasture', 'deep', 'pumice', 'lakeclip', 'resv', 'floor', 'alpine', 'mtclip', 'cpwater', 'cpgrass', 'savg', 'harbour', 'ledge', 'abqg', 'atl', 'sandg', 'lh5', 'qriver', 'qground', 'dlot', 'svsnow', 'imstar', 'imsgrass']:
        # match the definition, not any element that happens to share the name
        for kind in ('linearGradient', 'radialGradient', 'pattern', 'filter', 'clipPath'):
            inner = inner.replace(f'<{kind} id="{gid}"', f'<{kind} id="{sid}-{gid}"')
        inner = inner.replace(f'url(#{gid})', f'url(#{sid}-{gid})')
    return inner


cards = []
for sid, state, dest, hero, consist in CATALOGUE:
    inner = namespace(strip((SCENES / f'{sid}.svg').read_text()), sid)
    mark = '<g id="scenery-front"'
    before, after = inner.split(mark, 1)
    train_layer = (f'<g class="smoke" data-sid="{sid}"></g>'
                   f'<g class="consist" data-sid="{sid}" data-veh="{",".join(consist)}"></g>')
    body = before + train_layer + mark + after
    names = ' + '.join(manifest[c]['label'] for c in consist)
    cards.append(
        f'<figure class="card" id="card-{sid}">'
        f'<figcaption><div><b>{dest}</b> <span class="st">{state}</span></div>'
        f'<div class="hero">{hero}</div></figcaption>'
        f'<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">{body}</svg>'
        f'<div class="consist-label">🚂 {names}</div></figure>')

pool = ''.join(f'<g class="pool" data-veh="{k}">{veh_inner(k)}</g>'
               for k in sorted({c for _, _, _, _, cs in CATALOGUE for c in cs}))

HTML = r"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chuga Chocho — locations</title>
<style>
  body{margin:0;background:#0f1319;color:#e8eef5;font-family:'Trebuchet MS',system-ui,sans-serif;
    padding:20px 16px 60px}
  h1{font-size:1.5rem;margin:0 0 4px;text-align:center}
  .sub{text-align:center;opacity:.6;font-size:.92rem;margin:0 0 16px}
  .bar{position:sticky;top:0;z-index:9;display:flex;gap:16px;flex-wrap:wrap;justify-content:center;
    align-items:center;background:#1a2029;padding:11px 20px;border-radius:999px;margin:0 auto 18px;
    width:fit-content;box-shadow:0 6px 22px rgba(0,0,0,.5)}
  .bar label{font-size:.85rem;opacity:.85;display:flex;align-items:center;gap:7px}
  input[type=range]{width:170px}
  button{border:none;background:#3d7bd6;color:#fff;font-weight:bold;padding:.45rem 1.1rem;
    border-radius:999px;cursor:pointer;font-size:.85rem}
  .grid{display:grid;gap:20px;grid-template-columns:1fr;max-width:1320px;margin:0 auto}
  @media(min-width:1180px){.grid{grid-template-columns:1fr 1fr}}
  .card{margin:0;background:#1b2129;border-radius:16px;padding:12px 14px 10px;
    box-shadow:0 6px 22px rgba(0,0,0,.4)}
  figcaption{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
    margin-bottom:8px;flex-wrap:wrap}
  figcaption b{font-size:1.05rem}
  .st{opacity:.5;font-size:.8rem;margin-left:6px}
  .hero{opacity:.45;font-size:.78rem;text-align:right;max-width:52ch}
  svg{display:block;width:100%;height:auto;border-radius:10px;overflow:hidden}
  .consist-label{opacity:.4;font-size:.75rem;margin-top:7px}
</style></head>
<body>
<h1>🗺️ Chuga Chocho — locations</h1>
<p class="sub">Eight destinations. Every scene shares the same road, track and pair of crossing gates —
only the world around them changes.</p>
<div class="bar">
  <button id="playBtn">⏸ Pause</button>
  <label>Speed <input type="range" id="speed" min="0" max="6" step="0.05" value="1.9"></label>
  <button id="stepBtn" style="background:#4a515b">Step ▸</button>
</div>
<div class="grid">__CARDS__</div>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">__POOL__</svg>
<script>
const SVGNS='http://www.w3.org/2000/svg', MANIFEST=__MANIFEST__, DEG=180/Math.PI;
const S=0.5, RAIL_Y=500, GAP=8;
const SG={DRIVER_R:27,CRANK_R:14,MAIN_ROD_L:64,GUIDE_Y:-40,CYL_REAR:138,CX:[0,54,108]};
function setLine(el,a,b){ if(!el)return; el.setAttribute('x1',a[0]);el.setAttribute('y1',a[1]);
  el.setAttribute('x2',b[0]);el.setAttribute('y2',b[1]); }
function driveSteam(root,dist){
  const th=dist/SG.DRIVER_R, deg=th*DEG;
  SG.CX.forEach((cx,i)=>{const d=root.querySelector('[data-part="driver-'+i+'"]');
    if(d)d.setAttribute('transform',`rotate(${deg.toFixed(2)} ${cx} -27)`);});
  const pin=cx=>[cx+SG.CRANK_R*Math.cos(th),-27+SG.CRANK_R*Math.sin(th)];
  const p0=pin(0),p1=pin(54),p2=pin(108);
  setLine(root.querySelector('[data-part="coupling-rod"]'),p0,p2);
  setLine(root.querySelector('[data-part="coupling-rod-hi"]'),p0,p2);
  const dy=p1[1]-SG.GUIDE_Y, dx=Math.sqrt(Math.max(1,SG.MAIN_ROD_L**2-dy*dy)), xc=p1[0]+dx;
  setLine(root.querySelector('[data-part="main-rod"]'),[xc,SG.GUIDE_Y],p1);
  const ch=root.querySelector('[data-part="crosshead"]'); if(ch)ch.setAttribute('x',(xc-7).toFixed(2));
  setLine(root.querySelector('[data-part="piston-rod"]'),[SG.CYL_REAR,SG.GUIDE_Y],[xc,SG.GUIDE_Y]);
  [p0,p1,p2].forEach((p,i)=>{const e=root.querySelector('[data-part="pin-'+i+'"]');
    if(e){e.setAttribute('cx',p[0]);e.setAttribute('cy',p[1]);}});
}
function spin(root,dist){ root.querySelectorAll('.cc-wheel').forEach(w=>{
  w.setAttribute('transform',`rotate(${(dist/(+w.dataset.r)*DEG).toFixed(1)} ${w.dataset.cx} ${w.dataset.cy})`);});}

const trains=[];
document.querySelectorAll('.consist').forEach(host=>{
  const keys=host.dataset.veh.split(',');
  let front=0; const parts=[];
  keys.forEach(k=>{
    const m=MANIFEST[k], src=document.querySelector(`.pool[data-veh="${k}"]`);
    const g=document.createElementNS(SVGNS,'g'); g.innerHTML=src.innerHTML; host.appendChild(g);
    parts.push({g,offset:front-(m.length-m.originFromRear),isSteam:k==='steam'});
    front-=(m.length+GAP);
  });
  const total=-front;
  trains.push({host,parts,total,
    smoke:document.querySelector(`.smoke[data-sid="${host.dataset.sid}"]`),
    x:-total*S-120, puffs:[], lastChuff:0});
});

function layout(t){
  const dist=t.x/S;
  t.parts.forEach(v=>{
    v.g.setAttribute('transform',`translate(${(t.x+v.offset*S).toFixed(1)},${RAIL_Y}) scale(${S})`);
    spin(v.g,dist); if(v.isSteam) driveSteam(v.g,dist);
  });
}
function smoke(t){
  const head=t.parts[0]; if(!head||!head.isSteam||!t.smoke) return;
  const th=(t.x/S)/SG.DRIVER_R, ch=Math.floor(th/(Math.PI/2));
  if(ch!==t.lastChuff){ t.lastChuff=ch;
    const c=document.createElementNS(SVGNS,'circle'); c.setAttribute('fill','#fff');
    t.smoke.appendChild(c);
    t.puffs.push({x:t.x+(head.offset+134)*S,y:RAIL_Y-134*S,r:4,o:.8,el:c});
    if(t.puffs.length>36) t.puffs.shift().el.remove();
  }
  for(let i=t.puffs.length-1;i>=0;i--){ const p=t.puffs[i];
    p.y-=.5;p.x-=.2;p.r+=.3;p.o-=.009;
    if(p.o<=0){p.el.remove();t.puffs.splice(i,1);continue;}
    p.el.setAttribute('cx',p.x.toFixed(1));p.el.setAttribute('cy',p.y.toFixed(1));
    p.el.setAttribute('r',p.r.toFixed(1));p.el.setAttribute('opacity',p.o.toFixed(3));
  }
}
let running=true; const speedEl=document.getElementById('speed');
function advance(v){ trains.forEach(t=>{ t.x+=v;
  if(t.x>1400){ t.x=-t.total*S-120; t.puffs.forEach(p=>p.el.remove()); t.puffs=[]; }
  layout(t); smoke(t); }); }
function frame(){ if(running) advance(parseFloat(speedEl.value)); requestAnimationFrame(frame); }
trains.forEach(layout); requestAnimationFrame(frame);
document.getElementById('playBtn').addEventListener('click',e=>{running=!running;
  e.target.textContent=running?'⏸ Pause':'▶ Play';});
document.getElementById('stepBtn').addEventListener('click',()=>advance(4));
window.__pause=()=>{running=false;};
window.__setX=v=>{trains.forEach(t=>{t.x=v;layout(t);});};
</script>
</body></html>
"""

html = (HTML.replace('__CARDS__', ''.join(cards))
            .replace('__POOL__', pool)
            .replace('__MANIFEST__', json.dumps(manifest)))
out = pathlib.Path(__file__).resolve().parent / 'scene-gallery.html'
out.write_text(html)
print('wrote', out, len(html) // 1024, 'KB ·', len(cards), 'scenes')
