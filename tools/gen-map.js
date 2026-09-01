/**
 * Chuga Chocho — US map generator.
 *
 * Emits:
 *   play/assets/us-map.svg   standalone map asset
 *   play/js/map-data.js      the same SVG inlined as a JS string (the game loads THIS,
 *                            because fetch() is blocked on file://)
 *
 * Supported states are highlighted and carry the STATE NAME as a label. Cities are not
 * marked on the map — tapping a state with more than one city shows the city chooser
 * at the bottom of the picker (see play/js/map.js).
 *
 * Deps (not committed):  npm install d3-geo topojson-client us-atlas
 * Run:                   node tools/gen-map.js
 */
const fs = require('fs');
const path = require('path');
const { geoAlbersUsa, geoPath } = require('d3-geo');
const topojson = require('topojson-client');
const topo = require('us-atlas/states-10m.json');

const ROOT = path.resolve(__dirname, '..');
const fc = topojson.feature(topo, topo.objects.states);

const W = 980, H = 600, PAD = 12;
const projection = geoAlbersUsa().fitSize([W, H], fc);
const geo = geoPath(projection);
const roundD = d => (d || '').replace(/-?\d+\.\d+/g, n => Math.round(parseFloat(n)).toString());
const r1 = v => Math.round(v * 10) / 10;

// Supported states -> their destinations. A destination is a city (San Francisco)
// or a natural place (Rocky Mountains) — never just the state name repeated.
// A state has as many destinations as it has visually distinct looks.
// Must stay in sync with play/js/world.js.
const SUPPORTED = {
  'Iowa': ['Dubuque'],
  'Wisconsin': ['Wisconsin Dells'],
  'Oklahoma': ['Oklahoma City'],
  'Alabama': ['Birmingham'],
  'Arkansas': ['Bentonville'],
  'California': ['San Francisco', 'Los Angeles'],
  'Colorado': ['Rocky Mountains'],
  'Illinois': ['Chicago'],
  'Arizona': ['Grand Canyon'],
  'New York': ['New York City'],
  'Washington': ['Seattle'],
  'Louisiana': ['New Orleans'],
  'Texas': ['Austin', 'Houston'],
  'Florida': ['Cape Canaveral', 'Miami Beach'],
  'Hawaii': ['Oahu'],
  'Alaska': ['Denali'],
  'Nevada': ['Las Vegas'],
  'Utah': ['Moab'],
  'Tennessee': ['Nashville', 'Gatlinburg'],
  'Massachusetts': ['Boston'],
  'Wyoming': ['Yellowstone'],
  'District of Columbia': ['Washington'],
  'Minnesota': ['Duluth'],
  'Kansas': ['Wheat Country'],
  'Missouri': ['Kansas City'],
  'Pennsylvania': ['Horseshoe Curve'],
  'Oregon': ['Crater Lake'],
  'Kentucky': ['Bluegrass'],
  'New Hampshire': ['Mount Washington'],
  'Ohio': ['Cedar Point'],
  'Georgia': ['Savannah'],
  'Maine': ['Stonington'],
  'New Mexico': ['Albuquerque'],
  'North Carolina': ['Cape Hatteras'],
  'Vermont': ['Quechee'],
  'Michigan': ['Detroit'],
  'Idaho': ['Sun Valley'],
  'Indiana': ['Indianapolis'],
  'West Virginia': ['New River Gorge'],
  'South Dakota': ['Mount Rushmore'],
  'Mississippi': ['Vicksburg'],
  'Rhode Island': ['Newport'],
  'Connecticut': ['Mystic'],
  'Nebraska': ['Bailey Yard'],
  'South Carolina': ['Charleston'],
  'Montana': ['Essex'],
};

// Two-letter USPS abbreviations — shown on the map. The FULL state name is
// revealed in the picker only after the child taps a state (see play/js/map.js).
const ABBR = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
  'Connecticut':'CT','Delaware':'DE','District of Columbia':'DC','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY',
  'Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
  'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH',
  'New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',
  'Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI',
  'South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
};

// Small north-eastern states have no room for a label inside them: their
// abbreviations sit in a column off the Atlantic coast with a leader line.
const COLUMN = ['Vermont','New Hampshire','Massachusetts','Rhode Island','Connecticut',
                'New Jersey','Delaware','Maryland','District of Columbia'];
const RIGHT = 86;                    // extra margin for that column
const COL_X = W + 26;
// Spacing is set for ALL NINE column states being playable, not for the two that
// are today: at the old 21px step nine tap-chips would sit shoulder to shoulder
// with no gap, and a near-miss would land the child on the neighbouring state —
// worse than missing, because it silently takes them somewhere they didn't pick.
// 46 spreads the nine over y=116..484 of a 600-tall map, which is room the column
// was never using, and leaves a real gap between targets.
const COL_STEP = 46;
const COL_Y0 = Math.round((H - COL_STEP * (COLUMN.length - 1)) / 2);
const CHIP_W = 66, CHIP_H = 40;      // the invisible tap target behind each label

// A few states whose centroid needs a nudge to sit nicely.
const NUDGE = {
  'Michigan': [10, 12], 'Louisiana': [-6, 6], 'Florida': [10, 0],
  'Idaho': [0, 14], 'Hawaii': [0, 6], 'Alaska': [10, 0], 'Virginia': [8, 2],
  'California': [2, 4], 'New York': [-4, 6],
};

const slug = s => s.toLowerCase().replace(/[^a-z]+/g, '-');

const paths = [];
const labels = [];
// A second, invisible copy of each PLAYABLE state, drawn on top with a fat
// transparent stroke. Thin states are brutal tap targets for a three-year-old —
// only 29% of Florida's bounding box is actually Florida, and the peninsula is
// about as wide as a fingertip. This adds a forgiving halo around the outline
// without changing how the map looks. `fill:none` means the interior still
// belongs to the real path, so hover and focus keep working normally.
const hits = [];

fc.features
  .filter(f => f.properties && f.properties.name)
  .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
  .forEach(f => {
    const name = f.properties.name;
    const d = roundD(geo(f));
    if (!d) return;                                     // outside the Albers-USA clip
    const sup = Object.prototype.hasOwnProperty.call(SUPPORTED, name);
    const cities = sup ? SUPPORTED[name].join('|') : '';
    const attrs = [
      `class="state${sup ? ' state--supported' : ''}"`,
      `id="us-${slug(name)}"`,
      `data-name="${name}"`,
      sup ? 'data-supported="true"' : '',
      cities ? `data-cities="${cities}"` : '',
      `tabindex="${sup ? 0 : -1}"`,
    ].filter(Boolean).join(' ');
    paths.push(`    <path ${attrs} d="${d}"><title>${name}</title></path>`);
    if (sup) {
      // Carries .state and .state--supported so map.js's delegated handler routes
      // it exactly like the real shape; tabindex -1 so it is not a second tab stop.
      hits.push(`    <path class="state state--supported state-hit" data-name="${name}" tabindex="-1" d="${d}"/>`);
    }

    const ab = ABBR[name];
    if (!ab) return;
    const c = geo.centroid(f);
    if (!c || isNaN(c[0])) return;
    const cls = sup ? 'lbl lbl--on' : 'lbl';
    const ci = COLUMN.indexOf(name);
    if (ci >= 0) {
      const ly = COL_Y0 + ci * COL_STEP;
      labels.push(`    <line class="leader" x1="${r1(c[0])}" y1="${r1(c[1])}" x2="${COL_X - 7}" y2="${ly - 4}"/>`);
      labels.push(`    <text class="${cls}" x="${COL_X}" y="${ly}" text-anchor="start">${ab}</text>`);
      // A column state is a state too small to label in place, which means it is
      // also too small to TAP in place: the District of Columbia is a 3x4px
      // speck at national scale, ~13x13px even with the halo, against the ~44px
      // a small finger actually needs. So its label out in the clear margin —
      // and the whole leader line pointing at it — become tap targets as well.
      // The child aims at the big obvious label instead of a dot they cannot
      // see. Fixes DC and Massachusetts now, and every crowded north-eastern
      // state the roadmap adds later.
      if (sup) {
        hits.push(`    <line class="state state--supported state-hit" data-name="${name}" ` +
                  `x1="${r1(c[0])}" y1="${r1(c[1])}" x2="${COL_X - 7}" y2="${ly - 4}"/>`);
        hits.push(`    <rect class="state state--supported state-hit label-hit" data-name="${name}" ` +
                  `x="${COL_X - 14}" y="${ly - CHIP_H + 12}" width="${CHIP_W}" height="${CHIP_H}"/>`);
      }
      // Mark the real shape so the picker can find every state that lives in the
      // crowded corner without hard-coding the list twice.
      paths[paths.length - 1] = paths[paths.length - 1]
        .replace('<path ', '<path data-zone="northeast" ');
    } else {
      const n = NUDGE[name] || [0, 4];
      labels.push(`    <text class="${cls}" x="${r1(c[0] + n[0])}" y="${r1(c[1] + n[1])}" text-anchor="middle">${ab}</text>`);
    }
  });

// ONE big target for the crowded north-east. Those nine states are specks — DC is
// 3x4px — and even their label chips scale with the map, so on a phone they come
// out 26x15px. No amount of nudging fixes that: the targets live in map units and
// the map shrinks. So the whole column becomes a single card, and pressing it
// opens a chooser of full-size buttons (map.js `pickZone`). The per-state chips
// stay as well, so a steady hand on a big screen can still pick directly.
const NE_X = COL_X - 18, NE_W = 78;
const NE_Y = COL_Y0 - 32, NE_H = COL_STEP * (COLUMN.length - 1) + 52;
const neAny = COLUMN.some(n => Object.prototype.hasOwnProperty.call(SUPPORTED, n));
// The tap zone is wider than the card it sits under, reaching left across empty
// Atlantic where there is nothing else to hit, so a near-miss still lands. Same
// idea as the state halos: the picture stays tidy, the target is forgiving.
const NE_ZX = COL_X - 56, NE_ZW = (W + RIGHT) - NE_ZX;
const neCard = neAny ? `    <rect class="ne-card" x="${NE_X}" y="${NE_Y}" width="${NE_W}" height="${NE_H}" rx="16"/>` : '';
const neZone = neAny ? `    <rect class="state ne-zone" data-zone="northeast" x="${NE_ZX}" y="${NE_Y - 10}" width="${NE_ZW}" height="${NE_H + 20}"/>` : '';

const vb = [-PAD, -PAD, W + PAD + RIGHT, H + PAD * 2].join(' ');
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Chuga Chocho — offline US map for the location picker.
     Generated by tools/gen-map.js from us-atlas (Natural Earth, public domain),
     geoAlbersUsa projection. Supported states are highlighted and labelled with the
     TWO-LETTER ABBREVIATION; the full state name and any cities appear in the
     chooser at the bottom of the picker once a state is tapped.
     Each <path> carries data-name; supported states add data-supported="true" and
     optional data-cities="City|City". Labels are non-interactive. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"
     id="us-map" role="group" aria-label="Map of the United States">
  <style>
    #us-map .state{ fill:#cfe0ce; stroke:#ffffff; stroke-width:1; stroke-linejoin:round; }
    #us-map .state--supported{ fill:#7fc17a; cursor:pointer; }
    #us-map .state--supported:hover,
    #us-map .state--supported:focus{ fill:#ffd166; outline:none; }
    #us-map .lbl{ font-family:'Trebuchet MS',system-ui,sans-serif; font-weight:bold;
      font-size:13px; fill:#7d8a80; stroke:#ffffff; stroke-width:2.5; paint-order:stroke;
      pointer-events:none; }
    #us-map .lbl--on{ fill:#12401f; font-size:15px; stroke-width:3; }
    #us-map .leader{ stroke:#9fb0a4; stroke-width:1; pointer-events:none; }
    /* The forgiving halo. Listed last and repeated for :hover/:focus so it beats
       the .state--supported rules above it and never paints anything. */
    #us-map .state-hit,
    #us-map .state-hit:hover,
    #us-map .state-hit:focus{ fill:none; stroke:transparent; stroke-width:14;
      pointer-events:stroke; cursor:pointer; outline:none; }
    /* The label chip is a solid target, not an outline one: pointer-events:all
       makes its whole face tappable even though it paints nothing. It keeps
       .state-hit so the pulse rule (which excludes .state-hit) can't light it up. */
    #us-map .label-hit{ pointer-events:all; }
    /* The crowded corner, drawn as one pressable card. It paints; the .ne-zone
       rect over it is what actually takes the tap. */
    #us-map .ne-card{ fill:#ffffff; opacity:.5; stroke:#7fc17a; stroke-width:2.5;
      stroke-dasharray:7 5; pointer-events:none; }
    /* stroke:none matters — .ne-zone carries .state for the delegated handler,
       and .state paints a white 1px outline, which drew a ghost box on the sea. */
    #us-map .ne-zone{ fill:none; stroke:none; pointer-events:all; cursor:pointer; }
  </style>
  <g class="states">
${paths.join('\n')}
  </g>
  <g class="hits">
${hits.join('\n')}
  </g>
  <g class="ne">
${neCard}
  </g>
  <g class="labels">
${labels.join('\n')}
  </g>
  <g class="zones">
${neZone}
  </g>
</svg>
`;

fs.writeFileSync(path.join(ROOT, 'play/assets/us-map.svg'), svg);

const inline = svg.replace(/<\?xml[^>]*\?>\s*/, '');
const js = `/* map-data.js — auto-generated by tools/gen-map.js. Do not edit by hand.
   The US map SVG inlined as a string so the picker works when the game is opened
   directly from disk (fetch() is blocked on file://). Re-run the generator to change it. */
(function (CC) { CC.US_MAP_SVG = ${JSON.stringify(inline)}; })(window.CC = window.CC || {});
`;
fs.writeFileSync(path.join(ROOT, 'play/js/map-data.js'), js);

console.log(`states: ${paths.length} · labels: ${labels.length} · ` +
            `svg ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
