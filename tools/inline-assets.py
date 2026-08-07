#!/usr/bin/env python3
"""Inline every runtime asset into play/js/asset-data.js.

WHY THIS EXISTS
    The game has to run when a parent double-clicks play/index.html. Under
    file:// a browser refuses fetch()/XHR, so the scene SVGs and manifest.json
    can never be loaded at runtime. The fix is the same one map-data.js already
    uses for the US map: bake the assets into a plain JavaScript file that a
    classic <script> tag can load.

WHAT IT EMITS
    CC.assets = {
      scenes:   { colorado: '<svg …>', … 8 },
      vehicles: { steam: '<svg …>', … 14 },
      manifest: { vehicles: { … } }          // manifest.json verbatim
    };
    CC.manifest = CC.assets.manifest;        // what trains.js reads

ID NAMESPACING — the part that is easy to get wrong
    Every scene defines <defs> with the SAME ids: sky, road, grass, pine …
    The game keeps several scenes mounted at once (so travelling back to a place
    is instant), and SVG resolves url(#sky) and <use href="#pine"> across the
    WHOLE document — first match wins. Mount Colorado and then Seattle and
    Seattle would silently borrow Colorado's sky. So every id is prefixed with
    the asset key here, and every reference to it is rewritten to match.

    Vehicles get the same treatment, plus the animated ids (driver-0, main-rod …)
    become data-part attributes, exactly like tools/build-gallery.py does, so
    several copies of one locomotive can coexist.

USAGE
    python3 tools/inline-assets.py          # re-run whenever the art changes
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCENES = ROOT / 'play/assets/scenes'
TRAINS = ROOT / 'play/assets/trains'
OUT = ROOT / 'play/js/asset-data.js'

# Scene key -> file, discovered from the directory. The key is the filename stem,
# which is exactly the `scene` field in play/js/world.js ('grand-canyon.svg' ->
# 'grand-canyon'). This used to be a hand-maintained list, and adding a location
# without remembering to extend it dropped the new scene silently: the art was on
# disk, the world entry existed, and the game still showed nothing. Globbing means
# a new scene is picked up by dropping the file in.
SCENE_FILES = {p.stem: p.name for p in sorted(SCENES.glob('*.svg'))}

# Ids the engine animates. Renamed to data-part so N copies of a vehicle can
# live in one document without clashing (build-gallery.py does the same).
ANIM_IDS = ['driver-0', 'driver-1', 'driver-2', 'coupling-rod', 'coupling-rod-hi',
            'main-rod', 'piston-rod', 'crosshead', 'pin-0', 'pin-1', 'pin-2']

# Ids the engine looks up inside a mounted scene. They must stay untouched or
# scene.js cannot find the layers it inserts the train between.
# Ids the ENGINE looks up inside a mounted scene, so they must survive the
# per-scene namespacing. Duplicates across several mounted scenes are fine —
# every lookup is scoped to that scene's own <svg> root, never to the document.
#   road       scene.js reads the carriageway's far edge to learn where the road
#              ends: most scenes run to the horizon, Crater Lake stops at the Rim
#              Drive junction and Horseshoe Curve at the visitor car park.
#   curve-path the centreline of a drawn railway an ambient train follows.
KEEP_IDS = {'gate-near', 'gate-far', 'scenery-front', 'track', 'road-surface',
            'road', 'curve-path'}


def strip(svg):
    """Drop the XML declaration, comments and inter-tag whitespace."""
    svg = re.sub(r'<\?xml[^>]*\?>', '', svg)
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S)
    svg = re.sub(r'>\s+<', '><', svg)
    return svg.strip()


def inner(svg):
    """Everything between <svg …> and </svg>."""
    return re.search(r'<svg[^>]*>(.*)</svg>', svg, flags=re.S).group(1)


def namespace_ids(markup, prefix, keep=frozenset()):
    """Prefix every id in `markup` and rewrite every reference to it.

    Handles the three ways SVG points at an id: href="#x", xlink:href="#x"
    and url(#x). Ids in `keep` are left alone (the engine looks those up).
    """
    ids = set(re.findall(r'\bid="([^"]+)"', markup)) - set(keep)
    if not ids:
        return markup
    alt = '|'.join(sorted((re.escape(i) for i in ids), key=len, reverse=True))
    markup = re.sub(r'\bid="(' + alt + r')"', lambda m: 'id="%s-%s"' % (prefix, m.group(1)), markup)
    markup = re.sub(r'(\b(?:xlink:)?href=")#(' + alt + r')"',
                    lambda m: '%s#%s-%s"' % (m.group(1), prefix, m.group(2)), markup)
    markup = re.sub(r'url\(#(' + alt + r')\)',
                    lambda m: 'url(#%s-%s)' % (prefix, m.group(1)), markup)
    return markup


def scene_markup(key, filename):
    svg = strip((SCENES / filename).read_text())
    body = namespace_ids(inner(svg), 's-' + key, keep=KEEP_IDS)
    # Re-wrap in our own <svg>: fixed viewBox, and `slice` so the art fills any
    # screen shape rather than letterboxing. SCENE_GUIDE.md §1 fixes 1280x720.
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" '
            'preserveAspectRatio="xMidYMid slice" class="cc-scene">' + body + '</svg>')


def vehicle_markup(key, filename):
    svg = strip((TRAINS / filename).read_text())
    view_box = re.search(r'viewBox="([^"]+)"', svg).group(1)
    body = inner(svg)
    for i in ANIM_IDS:
        body = body.replace('id="%s"' % i, 'data-part="%s"' % i)
    body = namespace_ids(body, 'v-' + key)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + view_box + '">'
            + body + '</svg>')


def main():
    manifest = json.loads((TRAINS / 'manifest.json').read_text())
    scenes = {k: scene_markup(k, f) for k, f in SCENE_FILES.items()}
    vehicles = {k: vehicle_markup(k, v['file']) for k, v in manifest['vehicles'].items()}

    lines = [
        '/* asset-data.js — AUTO-GENERATED by tools/inline-assets.py. Do not edit by hand.',
        '',
        '   Every scene, every vehicle and the rolling-stock manifest, inlined as strings so',
        '   the game works when play/index.html is opened straight from disk (fetch() is',
        '   blocked on file://). Ids are namespaced per asset so several scenes can be',
        '   mounted at once without their <defs> colliding. Re-run the generator after any',
        '   change to play/assets/. */',
        '(function (CC) {',
        "  'use strict';",
        '  CC.assets = {',
        '    scenes: {',
    ]
    for k in SCENE_FILES:
        lines.append('      %s: %s,' % (json.dumps(k), json.dumps(scenes[k])))
    lines.append('    },')
    lines.append('    vehicles: {')
    for k in manifest['vehicles']:
        lines.append('      %s: %s,' % (json.dumps(k), json.dumps(vehicles[k])))
    lines.append('    },')
    lines.append('    manifest: %s,' % json.dumps(manifest))
    lines.append('  };')
    lines.append('  // trains.js reads CC.manifest.vehicles for length/originFromRear/label.')
    lines.append('  CC.manifest = CC.assets.manifest;')
    lines.append('})(window.CC = window.CC || {});')

    text = '\n'.join(lines) + '\n'
    OUT.write_text(text)
    print('wrote %s — %d scenes, %d vehicles, %d KB'
          % (OUT.relative_to(ROOT), len(scenes), len(vehicles), len(text) // 1024))


if __name__ == '__main__':
    main()
