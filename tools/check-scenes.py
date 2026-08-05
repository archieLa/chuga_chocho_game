#!/usr/bin/env python3
"""
Scene checker. Run after every scene change:  python3 tools/check-scenes.py

Catches the bugs that are invisible in a diff and easy to miss in a render:
  1. malformed XML
  2. a missing gate / road / track, or gate geometry that has drifted
  3. layers emitted out of depth order
  4. url(#id) or href="#id" that resolves to nothing (renders as solid black)
  4b. shapes with NO fill and NO stroke — SVG defaults those to solid black, which is
      how a cliff face ends up looking like a hole in the picture
  5. props standing IN THE ROAD — a bench, a person or a fence where cars drive

Check 5 is the one that keeps biting. The road is a perspective ribbon, so its
width depends on y; a prop at x=700 is fine at y=400 and in the middle of the
carriageway at y=700.
"""
import re, sys, pathlib, xml.dom.minidom
import xml.etree.ElementTree as ET

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

    # --- shapes that will render solid black because nothing sets their fill ---
    # SVG defaults fill to black. A shape is only safe if it, or one of its ancestors,
    # sets fill (or it is stroke-only). Walk the real tree — a text-window heuristic
    # gets this wrong constantly.
    try:
        root = ET.fromstring(svg)
        SHAPES = {'path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse'}
        # Contents of these never paint directly — their fill comes from the use site,
        # or they are geometry-only (gradients, clip paths, masks).
        SKIP = {'defs', 'clipPath', 'mask', 'marker', 'symbol', 'pattern'}

        def sets(node, prop):
            if prop in node.attrib:
                return True
            style = node.attrib.get('style', '')
            return bool(re.search(r'(?:^|;)\s*%s\s*:' % prop, style))

        def walk(node, in_fill, in_stroke):
            tag = node.tag.split('}')[-1]
            if tag in SKIP:
                return
            has_fill = in_fill or sets(node, 'fill')
            has_stroke = in_stroke or sets(node, 'stroke')
            if tag in SHAPES and not has_fill and not has_stroke:
                snippet = ' '.join(f'{k}="{v}"' for k, v in list(node.attrib.items())[:3])
                probs.append('no fill or stroke anywhere up the tree (renders BLACK): <%s %s>'
                             % (tag, snippet[:70]))
            for kid in node:
                walk(kid, has_fill, has_stroke)
        walk(root, False, False)
    except ET.ParseError:
        pass

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
    # --- props standing ON the railway ---
    # The track band is y 450..516. Anything in scenery-back with its baseline inside that
    # band is standing on the rails: the track is drawn after this layer, so the prop's feet
    # get buried in the ballast and the building appears to sit on the line. Duluth had five
    # brick warehouses planted here. Scenery-front is exempt — it draws in front of the
    # track on purpose, and a prop there is nearer to the camera than the railway.
    # The band proper is y 450..516, but the top few pixels are the far shoulder — a prop
    # based at 450 reads as standing on the pavement BEHIND the rails, which is legitimate
    # and several shipped scenes do it deliberately. Only flag baselines well inside.
    TRACK_TOP, TRACK_BOT = 454, 516
    body = layer_body(svg, 'scenery-back')
    for m in re.finditer(r'translate\((-?[\d.]+),\s*(-?[\d.]+)\)', body):
        x, y = float(m.group(1)), float(m.group(2))
        if TRACK_TOP <= y <= TRACK_BOT:
            probs.append('prop standing on the track: scenery-back at (%.0f,%.0f) — '
                         'the track band is %d..%d' % (x, y, TRACK_TOP, TRACK_BOT))
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
