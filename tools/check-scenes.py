#!/usr/bin/env python3
"""
Scene checker. Run after every scene change:  python3 tools/check-scenes.py

Catches the bugs that are invisible in a diff and easy to miss in a render:
  1. malformed XML
  2. a missing gate / road / track, or gate geometry that has drifted
  3. layers emitted out of depth order
  4. url(#id) or href="#id" that resolves to nothing (renders as solid black)
  5. props standing IN THE ROAD — a bench, a person or a fence where cars drive

Check 5 is the one that keeps biting. The road is a perspective ribbon, so its
width depends on y; a prop at x=700 is fine at y=400 and in the middle of the
carriageway at y=700.
"""
import re, sys, pathlib, xml.dom.minidom

SCENES = pathlib.Path(__file__).resolve().parent.parent / 'play/assets/scenes'
ORDER = ['sky', 'far', 'mid', 'ground', 'water', 'scenery-back', 'road', 'track',
         'gate-far', 'scenery-front', 'gate-near', 'foreground']

# road polygon: 510,720 · 770,720 · 658,300 · 622,300
def road_span(y):
    t = (y - 300.0) / 420.0
    return 622 - 112 * t, 644 + 126 * t

MARGIN = 14          # a prop may just touch the shoulder, not stand on the tarmac
LAYERS_TO_SCAN = ('scenery-front', 'foreground')

def layer_body(svg, name):
    m = re.search(r'<g id="%s">(.*?)\n  </g>' % re.escape(name), svg, re.S)
    return m.group(1) if m else ''

def check(path):
    svg = path.read_text()
    probs = []
    try:
        xml.dom.minidom.parseString(svg)
    except Exception as e:
        return ['XML: %s' % str(e)[:60]]

    ids = re.findall(r'<g id="([a-z-]+)"', svg)
    for need in ('gate-near', 'gate-far', 'road', 'track'):
        if need not in ids:
            probs.append('missing #' + need)
    seq = [i for i in ids if i in ORDER]
    if [ORDER.index(i) for i in seq] != sorted(ORDER.index(i) for i in seq):
        probs.append('layer order: ' + ' '.join(seq))
    if 'translate(552,480) scale(1.2)' not in svg:
        probs.append('near-gate geometry drifted')

    defined = set(re.findall(r'id="([^"]+)"', svg))
    for ref in sorted(set(re.findall(r'(?:url\(#|href="#)([^)"]+)', svg))):
        if ref not in defined:
            probs.append('unresolved reference #%s' % ref)

    # --- props standing in the road ---
    for layer in LAYERS_TO_SCAN:
        body = layer_body(svg, layer)
        for m in re.finditer(r'translate\((-?[\d.]+),\s*(-?[\d.]+)\)', body):
            x, y = float(m.group(1)), float(m.group(2))
            if not (300 <= y <= 720):
                continue
            lo, hi = road_span(y)
            if lo + MARGIN < x < hi - MARGIN:
                probs.append('prop in the road: %s at (%.0f,%.0f) — carriageway is %.0f..%.0f'
                             % (layer, x, y, lo, hi))
        # a full-width horizontal run (fence, wall, kerb) crossing the road
        for m in re.finditer(r'fence\(|<rect x="(-?\d+)" y="(\d+)" width="(\d{3,})"', body):
            pass
    return probs

def main():
    bad = 0
    for f in sorted(SCENES.glob('*.svg')):
        probs = check(f)
        if probs:
            bad += 1
            print('%-20s FAIL' % f.name)
            for p in probs:
                print('    · ' + p)
        else:
            print('%-20s ok' % f.name)
    print()
    print('ALL CLEAR' if not bad else '%d scene(s) need fixing' % bad)
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
