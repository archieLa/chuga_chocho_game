#!/usr/bin/env python3
"""
Chuga Chocho — rolling-stock generator.

Writes every locomotive and wagon SVG into play/assets/trains/, plus manifest.json.
All vehicles share one convention so the engine can place and animate them uniformly:

  * Local coords: y = 0 is the RAIL LINE, +x is FORWARD. Vehicles face RIGHT.
  * Place with transform="translate(X, railY) scale(s)"; mirror with scale(-1,1).
  * Every wheel is <g class="cc-wheel" data-cx data-cy data-r> — the engine spins it
    with rotate(deg cx cy) where deg = (distance / r) in degrees. Radius varies per
    vehicle, so read data-r rather than assuming.
  * Recolour hooks (set fill): .cc-loco .cc-wagon .cc-wagon2 .cc-roof .cc-trim .cc-brass

Run:  python3 tools/gen-trains.py
"""
import json, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'play/assets/trains'
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- helpers ----

def wheel(cx, r, hub='#8d949d', tyre='#1b1f25', face='#2b313a', spokes=3):
    """A wheel that visibly rotates: solid disc, faint spokes, and one bright bolt
    off-centre so the spin reads instantly (kids watch the wheels)."""
    import math
    marks = []
    for i in range(spokes):
        a = math.pi * i / spokes
        dx, dy = math.cos(a) * (r - 6), math.sin(a) * (r - 6)
        marks.append(f'<line x1="{cx-dx:.1f}" y1="{-r-dy:.1f}" x2="{cx+dx:.1f}" y2="{-r+dy:.1f}"/>')
    bolt_r = max(2.2, r * 0.15)
    return (
        f'<g class="cc-wheel" data-cx="{cx}" data-cy="{-r}" data-r="{r}">'
        f'<circle cx="{cx}" cy="{-r}" r="{r}" fill="{tyre}"/>'
        f'<circle cx="{cx}" cy="{-r}" r="{r-3.5:.1f}" fill="{face}"/>'
        f'<g stroke="#454d57" stroke-width="{max(1.6, r*0.11):.1f}" stroke-linecap="round">{"".join(marks)}</g>'
        f'<circle cx="{cx}" cy="{-r}" r="{max(3, r*0.24):.1f}" fill="{hub}"/>'
        f'<circle cx="{cx + r*0.55:.1f}" cy="{-r}" r="{bolt_r:.1f}" fill="#c9d0d8"/>'
        f'</g>')


def truck(cx, r=14, n=2, spacing=40, frame=True, frame_fill='#343b44'):
    """A bogie: side frame plus n wheels centred on cx."""
    span = spacing * (n - 1)
    xs = [cx - span / 2 + i * spacing for i in range(n)]
    out = []
    if frame:
        w = span + r * 2 + 16
        out.append(f'<rect x="{cx-w/2:.1f}" y="{-r*2-8:.1f}" width="{w:.1f}" height="{r+8:.1f}" rx="4" fill="{frame_fill}"/>')
        out.append(f'<rect x="{cx-w/2+6:.1f}" y="{-r*2-4:.1f}" width="{w-12:.1f}" height="4" fill="#3a4049"/>')
    out += [wheel(x, r) for x in xs]
    return ''.join(out)


def underframe(L, truck_dx, y=-44, h=10, fill='#2f343c'):
    """Centre sill + bolsters. Without this a wagon body appears to float above its
    trucks — real cars have a visible frame bridging body to bogie."""
    hh = L / 2
    out = [f'<rect x="{-hh+8:.0f}" y="{y}" width="{L-16:.0f}" height="{h}" rx="2" fill="{fill}"/>']
    for s in (-1, 1):
        cx = s * truck_dx
        out.append(f'<rect x="{cx-27:.0f}" y="{y+h-3:.0f}" width="54" height="9" rx="3" fill="#262b33"/>')
    return ''.join(out)


def coupler(x, y=-46, w=12):
    d = w if x > 0 else -w
    return (f'<rect x="{min(x, x+d):.1f}" y="{y-3}" width="{abs(d):.1f}" height="6" fill="#2a2e35"/>'
            f'<rect x="{x + (d*0.7 if d>0 else d*0.7)-3:.1f}" y="{y-6}" width="6" height="12" rx="2" fill="#3a4049"/>')


def shadow(x0, x1):
    cx, rx = (x0 + x1) / 2, (x1 - x0) / 2
    return f'<ellipse cx="{cx:.1f}" cy="2" rx="{rx:.1f}" ry="6" fill="#000" opacity="0.17"/>'


def windows(x0, x1, y0, y1, n, gap=10, rx=3, fill='#bfe3f5', top='#dff2fc'):
    total = x1 - x0
    w = (total - gap * (n + 1)) / n
    out = []
    for i in range(n):
        x = x0 + gap + i * (w + gap)
        out.append(f'<rect x="{x:.1f}" y="{y0}" width="{w:.1f}" height="{y1-y0}" rx="{rx}" fill="{fill}"/>')
        out.append(f'<rect x="{x:.1f}" y="{y0}" width="{w:.1f}" height="{(y1-y0)*0.38:.1f}" rx="{rx}" fill="{top}"/>')
    return ''.join(out)


def ribs(x0, x1, y0, y1, step=14, colour='#000', op=0.10):
    out = []
    x = x0 + step
    while x < x1:
        out.append(f'<rect x="{x:.1f}" y="{y0}" width="3" height="{y1-y0}" fill="{colour}" opacity="{op}"/>')
        x += step
    return ''.join(out)


def svg(name, vb, body, note):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<!-- Chuga Chocho — {note}\n'
            f'     y=0 is the RAIL LINE, +x forward, faces RIGHT.\n'
            f'     Wheels: <g class="cc-wheel" data-cx data-cy data-r> — spin with rotate(deg cx cy),\n'
            f'     deg = distance / data-r (radians -> degrees).\n'
            f'     Recolour: .cc-loco .cc-wagon .cc-wagon2 .cc-roof .cc-trim .cc-brass -->\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" id="{name}">\n{body}\n</svg>\n')


VEHICLES = {}
def emit(name, vb, body, note, length, origin_from_rear, kind, label):
    (OUT / f'{name}.svg').write_text(svg(name, vb, body, note))
    VEHICLES[name] = dict(file=f'{name}.svg', kind=kind, label=label,
                          length=length, originFromRear=origin_from_rear)

# ============================================================ LOCOMOTIVES ====

def diesel():
    """Big American diesel-electric road unit (Union Pacific / Metra flavour).

    BUILT IN THREE PASSES — shells, then livery, then details — rather than in
    drawing order. The livery has to sit over every painted surface and under
    every fitting, and with the pieces interleaved that is impossible: the cab
    glass is drawn before the nose, so a livery placed late enough to cover the
    nose also covered the windows, and the hood ribs ended up ON the blue and
    UNDER the white. Grouping the passes makes both correct by construction.
    """
    b = [shadow(-230, 235)]
    # frame / walkway
    b.append('<rect x="-228" y="-54" width="462" height="12" rx="3" fill="#3a4049"/>')
    b.append('<rect class="cc-trim" x="-228" y="-46" width="462" height="5" fill="#c0392b"/>')

    # ---- pass 1: the painted shells --------------------------------------
    b.append('<rect class="cc-loco" x="-212" y="-120" width="330" height="66" rx="6" fill="#e8b62c"/>')
    b.append('<rect class="cc-loco" x="118" y="-146" width="86" height="92" rx="7" fill="#e8b62c"/>')
    b.append('<path class="cc-loco" d="M204,-118 L226,-108 L232,-54 L204,-54 Z" fill="#e8b62c"/>')

    # ---- pass 2: the paint scheme ----------------------------------------
    # THE STARS-AND-STRIPES LIVERY, off unless a child asks for it.
    #
    # RAKED, NOT BANDED. The first attempt divided the body into three horizontal
    # stripes and the maintainer was right that it missed the point: on the real
    # unit the colours are separated by steeply ANGLED lines running up and
    # forward, and there is a row of stars along the flank. Those two things are
    # the whole signature — horizontal bands are just a painted train.
    #
    # Two parallel rakes divide it: blue behind, white between, red in front over
    # the cab and the nose. The base body IS the blue, so only the white and the
    # red are drawn.
    #
    # The polygons follow the SILHOUETTE rather than being clipped to it. The
    # hood stops at y=-120 and the cab goes up to -146, so a rake drawn straight
    # across the full height spills into open sky above the hood; each region is
    # emitted per body section instead, which needs no clipPath and so nothing
    # for the id-namespacing in inline-assets.py to rewrite.
    #
    # It goes in HERE, after the body and before the details, so the cab glass,
    # the headlight, the ditch lights and the horn all paint over it. Appended at
    # the end it covered the windows and the loco went blind.
    def star(cx, cy, r):
        import math
        pts = []
        for k in range(10):
            rr = r if k % 2 == 0 else r * 0.4
            a = math.radians(-90 + k * 36)
            pts.append(f'{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}')
        return '<polygon points="' + ' '.join(pts) + '" fill="#f2f4f7"/>'

    WHITE, RED = '#f2f4f7', '#c8202e'
    b.append('<g class="cc-livery" data-livery="flag" display="none">')
    #   white, from the rear rake forward — over the hood, then over the cab
    b.append(f'<path d="M10,-54 L43,-120 L118,-120 L118,-54 Z" fill="{WHITE}"/>')
    b.append(f'<path d="M118,-54 L118,-146 L196,-146 L150,-54 Z" fill="{WHITE}"/>')
    #   red, forward of the front rake: the cab front and the whole nose
    b.append(f'<path d="M150,-54 L196,-146 L204,-146 L204,-54 Z" fill="{RED}"/>')
    b.append(f'<path d="M204,-118 L226,-108 L232,-54 L204,-54 Z" fill="{RED}"/>')
    #   and the stars along the blue, which is the bit nothing else in the set has
    b.append(''.join(star(x, -88, 9) for x in (-186, -148, -110, -72, -34)))
    b.append('</g>')
    # ---- pass 3: everything bolted to the outside ------------------------
    b.append('<rect class="cc-roof" x="-212" y="-128" width="330" height="12" rx="5" fill="#8d959e"/>')
    b.append('<rect class="cc-roof" x="114" y="-154" width="94" height="12" rx="5" fill="#8d959e"/>')
    # radiator fans + exhaust
    b.append('<g fill="#6f7883"><circle cx="-176" cy="-128" r="13"/><circle cx="-140" cy="-128" r="13"/></g>')
    b.append('<g fill="#4a515b"><circle cx="-176" cy="-128" r="7"/><circle cx="-140" cy="-128" r="7"/></g>')
    b.append('<rect x="-90" y="-140" width="26" height="14" rx="3" fill="#41474f"/>')
    # side grilles + louvres
    b.append(ribs(-206, 110, -114, -60, 20, '#000', 0.13))
    b.append('<rect x="-60" y="-112" width="120" height="34" rx="4" fill="#000" opacity="0.14"/>')
    # cab glazing
    b.append('<rect x="126" y="-138" width="34" height="30" rx="3" fill="#bfe3f5"/>')
    b.append('<path d="M168,-138 L198,-138 L202,-108 L168,-108 Z" fill="#bfe3f5"/>')
    b.append('<path d="M168,-138 L198,-138 L200,-124 L168,-124 Z" fill="#dff2fc"/>')
    b.append('<rect class="cc-trim" x="204" y="-70" width="30" height="8" fill="#c0392b"/>')
    # headlight + ditch lights + horn
    b.append('<rect x="208" y="-104" width="20" height="14" rx="3" fill="#2f343c"/>')
    b.append('<circle cx="224" cy="-97" r="6" fill="#fff3c4"/>')
    b.append('<g fill="#ffe9a8"><circle cx="212" cy="-58" r="5"/><circle cx="230" cy="-58" r="5"/></g>')
    b.append('<g class="cc-brass" fill="#d4a943"><rect x="150" y="-160" width="24" height="7" rx="3"/></g>')
    # number board
    b.append('<rect x="120" y="-152" width="22" height="9" rx="2" fill="#f2f5f8" opacity="0.9"/>')
    # pilot / plough
    b.append('<path d="M232,-54 L240,-30 L232,-10 L206,-10 L206,-54 Z" fill="#41474f"/>')
    b.append('<g stroke="#8d959e" stroke-width="2"><line x1="212" y1="-46" x2="212" y2="-14"/>'
             '<line x1="220" y1="-44" x2="220" y2="-14"/><line x1="228" y1="-38" x2="228" y2="-14"/></g>')
    # three-axle trucks
    b.append(truck(-150, r=19, n=3, spacing=46))
    b.append(truck(160, r=19, n=3, spacing=46))
    b.append(coupler(-232))
    emit('diesel', '-250 -175 505 190', '  ' + ''.join(b),
         'DIESEL-ELECTRIC road locomotive (US freight/commuter)', 470, 236, 'engine',
         'Diesel-electric (freight)')


def electric_hs():
    """European high-speed electric power car (TGV / ICE / Velaro flavour)."""
    b = [shadow(-220, 230)]
    # body with a long raked nose
    b.append('<path class="cc-loco" d="M-216,-118 L120,-118 C 168,-114 206,-92 226,-58 '
             'L228,-44 L-216,-44 Z" fill="#eef2f6"/>')
    # dark window / glazing band sweeping into the nose
    b.append('<path d="M-206,-110 L118,-110 C 156,-106 186,-90 202,-66 L-206,-66 Z" fill="#2b3340"/>')
    b.append('<path d="M-206,-110 L118,-110 C 150,-107 176,-96 190,-80 L-206,-80 Z" fill="#3b475a"/>')
    # side windows
    b.append(windows(-196, 60, -104, -78, 5, gap=14, rx=4))
    # raked windscreen
    b.append('<path d="M132,-108 C 164,-103 188,-88 200,-70 L156,-70 L138,-108 Z" fill="#cfe9f8"/>')
    # bold livery stripe
    b.append('<path class="cc-trim" d="M-216,-60 L196,-60 C 210,-54 220,-50 226,-46 L228,-44 L-216,-44 Z" fill="#c0392b"/>')
    b.append('<path class="cc-trim" d="M120,-118 C 168,-114 206,-92 226,-58 L206,-58 C 190,-88 160,-106 120,-110 Z" fill="#c0392b"/>')
    # roof + insulators + pantograph (raised, single-arm)
    b.append('<rect class="cc-roof" x="-216" y="-126" width="336" height="10" rx="5" fill="#c3cbd4"/>')
    b.append('<g fill="#5b636d"><rect x="-150" y="-134" width="10" height="9" rx="2"/>'
             '<rect x="-60" y="-134" width="10" height="9" rx="2"/></g>')
    b.append('<g id="pantograph" stroke="#5b636d" stroke-width="5" fill="none" stroke-linecap="round">'
             '<path d="M-120,-130 L-84,-160"/><path d="M-84,-160 L-134,-186"/></g>')
    b.append('<rect x="-158" y="-192" width="70" height="7" rx="3" fill="#7b838d"/>')
    b.append('<rect x="-138" y="-134" width="34" height="7" rx="3" fill="#5b636d"/>')
    # skirts over the bogies
    b.append('<rect class="cc-loco" x="-200" y="-46" width="140" height="18" rx="6" fill="#dde4ea"/>')
    b.append('<rect class="cc-loco" x="10" y="-46" width="140" height="18" rx="6" fill="#dde4ea"/>')
    # headlights
    b.append('<g fill="#fff3c4"><circle cx="206" cy="-72" r="6"/><circle cx="214" cy="-58" r="5"/></g>')
    b.append(truck(-140, r=16, n=2, spacing=46))
    b.append(truck(70, r=16, n=2, spacing=46))
    b.append(coupler(-220))
    emit('electric-hs', '-245 -205 500 220', '  ' + ''.join(b),
         'HIGH-SPEED ELECTRIC power car (European style, with pantograph)', 450, 220, 'engine',
         'High-speed electric (Europe)')


def commuter():
    """City commuter EMU — corrugated stainless, CTA / NYC subway flavour."""
    b = [shadow(-200, 205)]
    # body with rounded cab end
    b.append('<path class="cc-loco" d="M-196,-124 L150,-124 C 178,-124 196,-110 198,-88 '
             'L198,-46 L-196,-46 Z" fill="#ccd3da"/>')
    # corrugated stainless ribbing
    b.append('<g fill="#9aa3ad" opacity="0.55">' + ''.join(
        f'<rect x="-192" y="{y}" width="380" height="2.5"/>' for y in range(-70, -48, 6)) + '</g>')
    b.append('<g fill="#9aa3ad" opacity="0.45">' + ''.join(
        f'<rect x="-192" y="{y}" width="380" height="2.5"/>' for y in range(-122, -110, 6)) + '</g>')
    # belt stripes
    b.append('<rect class="cc-trim" x="-196" y="-78" width="394" height="7" fill="#0b56a4"/>')
    b.append('<rect x="-196" y="-71" width="394" height="4" fill="#c0392b"/>')
    # windows
    b.append(windows(-190, 40, -114, -84, 4, gap=12, rx=4))
    b.append(windows(98, 146, -114, -84, 1, gap=5, rx=4))
    # doors (darker, with their own glazing)
    for dx in (48,):
        b.append(f'<rect x="{dx}" y="-120" width="46" height="74" rx="3" fill="#7f8892"/>')
        b.append(f'<rect x="{dx+4}" y="-114" width="17" height="30" rx="2" fill="#bfe3f5"/>')
        b.append(f'<rect x="{dx+25}" y="-114" width="17" height="30" rx="2" fill="#bfe3f5"/>')
        b.append(f'<rect x="{dx+22}" y="-120" width="2" height="74" fill="#5b636d"/>')
    # cab front: windscreen + destination sign + headlights
    b.append('<path d="M156,-116 C 178,-116 189,-104 191,-86 L156,-86 Z" fill="#bfe3f5"/>')
    b.append('<path d="M156,-116 C 174,-116 184,-109 188,-101 L156,-101 Z" fill="#dff2fc"/>')
    b.append('<g fill="#fff3c4"><circle cx="192" cy="-60" r="5.5"/></g>')
    b.append('<g class="cc-trim" fill="#c0392b"><circle cx="176" cy="-60" r="4"/></g>')
    # roof kit
    b.append('<rect class="cc-roof" x="-196" y="-134" width="352" height="12" rx="5" fill="#aeb6bf"/>')
    b.append('<g fill="#8d959e"><rect x="-150" y="-146" width="60" height="14" rx="5"/>'
             '<rect x="-20" y="-146" width="60" height="14" rx="5"/></g>')
    # third-rail shoe (nice authentic touch)
    b.append('<rect x="-108" y="-16" width="26" height="5" rx="2" fill="#c0392b"/>')
    b.append('<rect x="-190" y="-46" width="380" height="10" rx="2" fill="#2f343c"/>')
    b.append(truck(-130, r=16, n=2, spacing=44))
    b.append(truck(110, r=16, n=2, spacing=44))
    b.append(coupler(-200))
    emit('commuter', '-225 -165 460 180', '  ' + ''.join(b),
         'COMMUTER EMU (Chicago CTA / New York subway style)', 400, 200, 'engine',
         'Commuter EMU (city)')


def streetcar():
    """New Orleans St. Charles streetcar (Perley Thomas 900-series): olive green,
    red belt rail, arched windows, clerestory roof, trolley pole."""
    L = 300; h = L / 2
    b = [shadow(-h - 10, h + 10)]
    # body
    b.append(f'<rect class="cc-loco" x="{-h+8}" y="-124" width="{L-16}" height="82" rx="7" fill="#3d5233"/>')
    b.append(f'<rect x="{-h+8}" y="-124" width="{L-16}" height="14" rx="7" fill="#48603c"/>')
    # arched windows
    for i in range(7):
        x = -h + 22 + i * 36
        b.append(f'<rect x="{x}" y="-116" width="26" height="40" rx="13" fill="#f2ede0"/>')
        b.append(f'<rect x="{x+3}" y="-113" width="20" height="34" rx="10" fill="#dff0f6"/>')
        b.append(f'<rect x="{x+3}" y="-113" width="20" height="13" rx="9" fill="#eef8fc"/>')
    # red belt rail + gold lining
    b.append(f'<rect class="cc-trim" x="{-h+8}" y="-72" width="{L-16}" height="9" fill="#a63a2c"/>')
    b.append(f'<g class="cc-brass" fill="#d4a943"><rect x="{-h+8}" y="-64" width="{L-16}" height="2.5"/>'
             f'<rect x="{-h+8}" y="-110" width="{L-16}" height="2"/></g>')
    # clerestory roof
    b.append(f'<rect class="cc-roof" x="{-h+2}" y="-136" width="{L-4}" height="14" rx="7" fill="#e8e4d8"/>')
    b.append(f'<rect class="cc-roof" x="{-h+40}" y="-148" width="{L-80}" height="14" rx="6" fill="#f2efe4"/>')
    b.append('<g fill="#cdd6c4" opacity="0.9">' + ''.join(
        f'<rect x="{-h+56+i*32}" y="-145" width="16" height="8" rx="2"/>' for i in range(6)) + '</g>')
    # trolley pole reaching up to the wire
    b.append('<g stroke="#3f4a44" stroke-width="4" stroke-linecap="round">'
             '<path d="M-10,-148 L-72,-196"/></g>'
             '<circle cx="-10" cy="-148" r="6" fill="#3f4a44"/>'
             '<circle cx="-74" cy="-197" r="5" fill="#8d949c"/>')
    # front: destination box, headlight, fender
    b.append(f'<rect x="{h-58}" y="-138" width="46" height="13" rx="3" fill="#2c3a26"/>')
    b.append(f'<circle cx="{h-16}" cy="-92" r="9" class="cc-brass" fill="#d4a943"/>')
    b.append(f'<circle cx="{h-16}" cy="-92" r="6" fill="#fff3c4"/>')
    b.append(f'<path d="M{h-6},-48 L{h+22},-16 L{h-6},-16 Z" fill="#59616c"/>')
    b.append(f'<g stroke="#aeb6c0" stroke-width="2"><line x1="{h+2}" y1="-38" x2="{h+2}" y2="-18"/>'
             f'<line x1="{h+10}" y1="-30" x2="{h+10}" y2="-18"/></g>')
    # skirt + trucks
    b.append(f'<rect x="{-h+10}" y="-44" width="{L-20}" height="10" rx="3" fill="#2c3a26"/>')
    b.append(truck(-h + 62, r=15, n=2, spacing=40) + truck(h - 62, r=15, n=2, spacing=40))
    b.append(coupler(-h))
    emit('streetcar', '-175 -215 350 230', '  ' + ''.join(b),
         'NEW ORLEANS STREETCAR (St. Charles line, Perley Thomas style)', L, L / 2, 'engine',
         'Streetcar (New Orleans)')


def cable_car():
    """San Francisco cable car (Powell-Hyde): maroon and cream, open-air front section
    with bench seats and grab poles, running boards. No pole — it grips a moving cable."""
    L = 240; h = L / 2
    b = [shadow(-h - 8, h + 8)]
    # closed rear saloon
    b.append(f'<rect class="cc-loco" x="{-h+6}" y="-116" width="128" height="74" rx="5" fill="#8f3b32"/>')
    b.append(f'<rect x="{-h+6}" y="-116" width="128" height="12" rx="5" fill="#a34a3f"/>')
    for i in range(3):
        x = -h + 18 + i * 38
        b.append(f'<rect x="{x}" y="-106" width="26" height="34" rx="4" fill="#f4efe2"/>')
        b.append(f'<rect x="{x+3}" y="-103" width="20" height="28" rx="3" fill="#dff0f6"/>')
    # open front section: posts, bench, roof
    b.append(f'<rect class="cc-brass" x="{-h+6}" y="-72" width="128" height="4" fill="#d4a943"/>')
    b.append(f'<rect x="{-h+134}" y="-58" width="98" height="16" fill="#7d3229"/>')
    b.append('<g fill="#c9a06a">' + ''.join(
        f'<rect x="{-h+142+i*30}" y="-74" width="24" height="8" rx="3"/>' for i in range(3)) + '</g>')
    b.append('<g stroke="#5f2a22" stroke-width="5">' + ''.join(
        f'<line x1="{-h+140+i*32}" y1="-124" x2="{-h+140+i*32}" y2="-58"/>' for i in range(4)) + '</g>')
    # roof over both sections
    b.append(f'<rect class="cc-roof" x="{-h}" y="-130" width="{L}" height="14" rx="6" fill="#f2ede0"/>')
    b.append(f'<rect class="cc-roof" x="{-h+4}" y="-136" width="{L-8}" height="8" rx="4" fill="#fbf7ee"/>')
    b.append(f'<rect class="cc-trim" x="{-h}" y="-119" width="{L}" height="5" fill="#c0392b"/>')
    # destination board, headlight, dash
    b.append(f'<rect x="{-h+14}" y="-146" width="72" height="13" rx="3" fill="#5f2a22"/>')
    b.append(f'<circle cx="{h-14}" cy="-92" r="8" class="cc-brass" fill="#d4a943"/>')
    b.append(f'<circle cx="{h-14}" cy="-92" r="5.5" fill="#fff3c4"/>')
    b.append(f'<rect x="{h-30}" y="-58" width="30" height="16" rx="3" fill="#8f3b32"/>')
    # running boards + grip slot
    b.append(f'<rect x="{-h-4}" y="-42" width="{L+8}" height="7" rx="3" fill="#5f2a22"/>')
    b.append(f'<rect x="{-h+10}" y="-34" width="{L-20}" height="5" rx="2" fill="#3f4a44"/>')
    b.append(f'<rect x="-14" y="-30" width="28" height="6" rx="2" fill="#8d949c"/>')
    b.append(truck(-h + 52, r=14, n=2, spacing=38) + truck(h - 52, r=14, n=2, spacing=38))
    b.append(coupler(-h))
    emit('cable-car', '-150 -175 300 190', '  ' + ''.join(b),
         'SAN FRANCISCO CABLE CAR (Powell-Hyde line)', L, L / 2, 'engine',
         'Cable car (San Francisco)')

# ================================================================= WAGONS ====

def coach_old():
    """Heavyweight wooden-era passenger coach with a clerestory roof."""
    L = 280; h = L / 2
    b = [shadow(-h, h)]
    b.append(f'<rect class="cc-wagon" x="{-h+8}" y="-114" width="{L-16}" height="70" rx="5" fill="#1f4d3a"/>')
    # gold lining
    b.append(f'<g class="cc-brass" fill="#d4a943"><rect x="{-h+14}" y="-58" width="{L-28}" height="3"/>'
             f'<rect x="{-h+14}" y="-110" width="{L-28}" height="2.5"/></g>')
    # arched windows
    for i in range(7):
        x = -h + 22 + i * 34
        b.append(f'<rect x="{x}" y="-102" width="24" height="34" rx="11" fill="#bfe3f5"/>')
        b.append(f'<rect x="{x}" y="-102" width="24" height="14" rx="11" fill="#dff2fc"/>')
    # roof + clerestory
    b.append(f'<rect class="cc-roof" x="{-h+2}" y="-124" width="{L-4}" height="12" rx="6" fill="#5b636d"/>')
    b.append(f'<rect class="cc-roof" x="{-h+40}" y="-138" width="{L-80}" height="16" rx="6" fill="#6b737d"/>')
    b.append('<g fill="#f6d98a" opacity="0.85">' + ''.join(
        f'<rect x="{-h+52+i*30}" y="-134" width="16" height="8" rx="2"/>' for i in range(6)) + '</g>')
    # end platforms + railings
    for s in (-1, 1):
        b.append(f'<rect x="{s*(h-10)-6}" y="-52" width="12" height="10" fill="#3a4049"/>')
        b.append(f'<g stroke="#d4a943" stroke-width="2.5" fill="none">'
                 f'<path d="M{s*(h-4)},-52 L{s*(h-4)},-84"/><path d="M{s*(h-16)},-70 L{s*(h-4)},-70"/></g>')
    b.append(underframe(L, h - 58))
    b.append(truck(-h + 58, r=16, n=2, spacing=42) + truck(h - 58, r=16, n=2, spacing=42))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-coach-old', '-165 -160 330 175', '  ' + ''.join(b),
         'OLD-SCHOOL PASSENGER COACH (clerestory roof, arched windows)', L, L / 2, 'wagon',
         'Old passenger coach')


def caboose():
    L = 210; h = L / 2
    b = [shadow(-h, h)]
    b.append(f'<rect class="cc-wagon" x="{-h+10}" y="-106" width="{L-20}" height="62" rx="5" fill="#b8342b"/>')
    b.append(f'<rect class="cc-roof" x="{-h+4}" y="-116" width="{L-8}" height="12" rx="6" fill="#5b636d"/>')
    # cupola
    b.append('<rect class="cc-wagon" x="-34" y="-146" width="68" height="32" rx="4" fill="#b8342b"/>')
    b.append('<rect class="cc-roof" x="-40" y="-154" width="80" height="10" rx="5" fill="#5b636d"/>')
    b.append('<rect x="-26" y="-140" width="22" height="18" rx="3" fill="#bfe3f5"/>')
    b.append('<rect x="6" y="-140" width="22" height="18" rx="3" fill="#bfe3f5"/>')
    # side windows + door
    b.append('<rect x="-78" y="-96" width="26" height="26" rx="3" fill="#bfe3f5"/>')
    b.append('<rect x="52" y="-96" width="26" height="26" rx="3" fill="#bfe3f5"/>')
    b.append('<rect x="-16" y="-100" width="32" height="56" rx="3" fill="#8f2a22"/>')
    b.append('<circle cx="8" cy="-72" r="2.5" class="cc-brass" fill="#d4a943"/>')
    # marker lamps + railings
    b.append('<g class="cc-brass" fill="#d4a943"><rect x="-98" y="-104" width="8" height="10" rx="2"/>'
             '<rect x="90" y="-104" width="8" height="10" rx="2"/></g>')
    for s in (-1, 1):
        b.append(f'<g stroke="#e8e2c9" stroke-width="2.5" fill="none">'
                 f'<path d="M{s*(h-4)},-44 L{s*(h-4)},-78"/><path d="M{s*(h-18)},-64 L{s*(h-4)},-64"/></g>')
    b.append(underframe(L, h - 48))
    b.append(truck(-h + 48, r=15, n=2, spacing=38) + truck(h - 48, r=15, n=2, spacing=38))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-caboose', '-130 -175 260 190', '  ' + ''.join(b),
         'CABOOSE with cupola', L, L / 2, 'wagon', 'Caboose')


def coach_modern():
    """Bilevel commuter gallery car (Metra style)."""
    L = 290; h = L / 2
    b = [shadow(-h, h)]
    b.append(f'<rect class="cc-wagon" x="{-h+8}" y="-140" width="{L-16}" height="96" rx="7" fill="#c8ced5"/>')
    b.append('<g fill="#9aa3ad" opacity="0.5">' + ''.join(
        f'<rect x="{-h+12}" y="{y}" width="{L-24}" height="2.5"/>' for y in range(-64, -46, 6)) + '</g>')
    # upper + lower window rows
    b.append(windows(-h + 16, h - 16, -132, -108, 6, gap=12, rx=4))
    b.append(windows(-h + 16, h - 16, -96, -74, 6, gap=12, rx=4))
    b.append(f'<rect class="cc-trim" x="{-h+8}" y="-104" width="{L-16}" height="7" fill="#0b56a4"/>')
    b.append(f'<rect class="cc-roof" x="{-h+4}" y="-150" width="{L-8}" height="12" rx="6" fill="#aeb6bf"/>')
    # end doors
    for s in (-1, 1):
        b.append(f'<rect x="{s*(h-40)-16}" y="-136" width="32" height="92" rx="3" fill="#8f98a3"/>')
        b.append(f'<rect x="{s*(h-40)-12}" y="-130" width="24" height="26" rx="2" fill="#bfe3f5"/>')
    b.append(underframe(L, h - 56))
    b.append(truck(-h + 56, r=16, n=2, spacing=42) + truck(h - 56, r=16, n=2, spacing=42))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-coach-modern', '-170 -175 340 190', '  ' + ''.join(b),
         'MODERN BILEVEL COMMUTER COACH (Metra gallery car style)', L, L / 2, 'wagon',
         'Modern bilevel coach')


def hs_coach():
    """Sleek high-speed coach that matches the electric power car."""
    L = 280; h = L / 2
    b = [shadow(-h, h)]
    b.append(f'<rect class="cc-wagon" x="{-h+6}" y="-118" width="{L-12}" height="74" rx="8" fill="#eef2f6"/>')
    b.append(f'<rect x="{-h+12}" y="-110" width="{L-24}" height="34" rx="6" fill="#2b3340"/>')
    b.append(f'<rect x="{-h+12}" y="-110" width="{L-24}" height="14" rx="6" fill="#3b475a"/>')
    b.append(windows(-h + 18, h - 18, -104, -82, 5, gap=16, rx=5))
    b.append(f'<rect class="cc-trim" x="{-h+6}" y="-58" width="{L-12}" height="9" fill="#c0392b"/>')
    b.append(f'<rect class="cc-roof" x="{-h+10}" y="-126" width="{L-20}" height="10" rx="5" fill="#c3cbd4"/>')
    # bogie skirts
    b.append(f'<rect class="cc-wagon" x="{-h+14}" y="-46" width="100" height="18" rx="6" fill="#dde4ea"/>')
    b.append(f'<rect x="{h-114}" y="-46" width="100" height="18" rx="6" class="cc-wagon" fill="#dde4ea"/>')
    b.append('<g fill="#8f98a3">' + ''.join(
        f'<rect x="{-h+60+i*52}" y="-124" width="20" height="6" rx="3"/>' for i in range(4)) + '</g>')
    b.append(truck(-h + 62, r=16, n=2, spacing=44) + truck(h - 62, r=16, n=2, spacing=44))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-hs-coach', '-165 -150 330 165', '  ' + ''.join(b),
         'HIGH-SPEED COACH (matches the European electric power car)', L, L / 2, 'wagon',
         'High-speed coach')


def boxcar():
    L = 250; h = L / 2
    b = [shadow(-h, h)]
    b.append(f'<rect class="cc-wagon" x="{-h+8}" y="-118" width="{L-16}" height="74" rx="4" fill="#8a4a2f"/>')
    b.append(ribs(-h + 14, h - 14, -116, -46, 18, '#000', 0.14))
    b.append(f'<rect class="cc-roof" x="{-h+2}" y="-128" width="{L-4}" height="12" rx="5" fill="#6b737d"/>')
    # sliding door
    b.append('<rect x="-38" y="-114" width="76" height="66" rx="2" fill="#a35a38"/>')
    b.append('<rect x="-38" y="-114" width="76" height="6" fill="#5f3520"/>')
    b.append('<rect x="-4" y="-110" width="5" height="58" fill="#5f3520"/>')
    b.append('<rect x="-42" y="-52" width="84" height="5" fill="#4a2a19"/>')
    # reporting marks panel
    b.append('<rect x="-108" y="-102" width="62" height="22" rx="2" fill="#f2ece0" opacity="0.9"/>')
    b.append('<text x="-77" y="-86" text-anchor="middle" font-family="Trebuchet MS,sans-serif" '
             'font-size="11" fill="#5f3520">CC 42</text>')
    # ladders
    for s in (-1, 1):
        b.append(f'<g stroke="#d8cfc2" stroke-width="2.5"><line x1="{s*(h-18)}" y1="-116" x2="{s*(h-18)}" y2="-52"/>'
                 f'<line x1="{s*(h-30)}" y1="-116" x2="{s*(h-30)}" y2="-52"/>'
                 + ''.join(f'<line x1="{s*(h-30)}" y1="{y}" x2="{s*(h-18)}" y2="{y}"/>' for y in (-104, -88, -72, -58))
                 + '</g>')
    b.append(underframe(L, h - 52))
    b.append(truck(-h + 52, r=16, n=2, spacing=42) + truck(h - 52, r=16, n=2, spacing=42))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-boxcar', '-150 -155 300 170', '  ' + ''.join(b),
         'BOXCAR with sliding door', L, L / 2, 'wagon', 'Boxcar')


def autorack():
    """AUTO-RACK — the longest wagon in the set, and the only one whose load you can
    see. Detroit is the reason it exists: a car plant loads new cars onto trains, and
    a wagon that visibly carries little cars is a far better payoff for a small child
    than one more brown van.

    Open bi-level, because an enclosed one is a featureless box. The yellow cage is
    what says 'auto-rack' at a glance — real ones are a frame, not a wall.

    Vertical scheme follows the boxcar so it sits in a consist without looking like a
    different game: floor at -52, underframe at -44, wheels r=16, top at -134 against
    the boxcar's -128.
    """
    L = 290; h = L / 2
    DECK_LO, DECK_HI, ROOF = -52, -104, -134
    CARS = ['#c9382e', '#2f6f9e', '#e8b02a', '#4f8f5a', '#e6e2d8', '#7a4f9e']

    def minicar(x, base, colour):
        """A car riding on a deck. Tiny, so it is a silhouette with a window band —
        any more detail turns to mush at 0.55 scale and costs nothing but bytes."""
        return (f'<g transform="translate({x},{base})">'
                f'<rect x="-21" y="-15" width="42" height="11" rx="4" fill="{colour}"/>'
                f'<rect x="-14" y="-22" width="27" height="9" rx="4" fill="{colour}"/>'
                f'<rect x="-11" y="-20" width="21" height="5" rx="2" fill="#cfe4f2"/>'
                f'<circle cx="-12" cy="-3" r="4" fill="#23262b"/>'
                f'<circle cx="12" cy="-3" r="4" fill="#23262b"/></g>')

    b = [shadow(-h, h)]
    # the two decks and the eight cars riding on them
    for k, base in enumerate((DECK_HI, DECK_LO)):
        b.append(f'<rect class="cc-wagon2" x="{-h+6}" y="{base}" width="{L-12}" height="7" '
                 f'fill="#8f8a80"/>')
        for i in range(4):
            b.append(minicar(-h + 44 + i * 68, base, CARS[(i + k * 3) % len(CARS)]))
    # the cage — end posts full height, roof rail ABOVE the upper cars (they top out
    # at DECK_HI-22, so a rail at DECK_HI-14 ran straight through them), and light
    # uprights between.
    b.append(f'<rect class="cc-wagon" x="{-h}" y="{ROOF}" width="{L}" height="9" rx="3" fill="#c9a83a"/>')
    for s in (-1, 1):
        b.append(f'<rect class="cc-wagon" x="{s*h - (7 if s > 0 else 0):.0f}" y="{ROOF}" '
                 f'width="7" height="{DECK_LO + 7 - ROOF}" fill="#c9a83a"/>')
    b.append('<g class="cc-trim" stroke="#c9a83a" stroke-width="3.2" fill="none">'
             + ''.join(f'<path d="M{-h + 24 + i*40:.0f},{DECK_LO+7} v{ROOF-DECK_LO-7}"/>'
                       for i in range(1, int(L / 40)))
             + '</g>')
    # floor, frame, bogies, couplers — the same furniture as every other wagon
    b.append(f'<rect class="cc-wagon" x="{-h}" y="{DECK_LO}" width="{L}" height="8" rx="2" fill="#7d4a35"/>')
    b.append(underframe(L, h - 58))
    b.append(truck(-h + 58, r=16, n=2, spacing=42) + truck(h - 58, r=16, n=2, spacing=42))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-autorack', '-170 -160 340 175', '  ' + ''.join(b),
         'AUTO-RACK, open bi-level, carrying eight cars', L, L / 2, 'wagon', 'Auto-rack')


def tanker():
    L = 250; h = L / 2
    b = [shadow(-h, h)]
    b.append(f'<rect x="{-h+8}" y="-54" width="{L-16}" height="12" rx="3" fill="#3a4049"/>')
    # tank barrel + end caps
    b.append('<rect class="cc-wagon" x="-104" y="-116" width="208" height="62" rx="31" fill="#b9c0c8"/>')
    b.append('<ellipse class="cc-wagon" cx="-104" cy="-85" rx="14" ry="31" fill="#a7aeb7"/>')
    b.append('<ellipse class="cc-wagon" cx="104" cy="-85" rx="14" ry="31" fill="#a7aeb7"/>')
    b.append('<rect x="-104" y="-116" width="208" height="18" rx="9" fill="#ffffff" opacity="0.22"/>')
    # bands
    b.append('<g fill="#8f98a3">' + ''.join(
        f'<rect x="{x}" y="-116" width="4" height="62"/>' for x in (-58, -12, 34, 78)) + '</g>')
    # manway dome + walkway + ladder
    b.append('<rect class="cc-wagon" x="-16" y="-130" width="32" height="16" rx="4" fill="#a7aeb7"/>')
    b.append('<rect class="cc-brass" x="-12" y="-136" width="24" height="7" rx="3" fill="#d4a943"/>')
    b.append('<rect x="-60" y="-122" width="120" height="5" rx="2" fill="#8f98a3"/>')
    b.append('<g stroke="#8f98a3" stroke-width="2.5"><line x1="96" y1="-118" x2="96" y2="-56"/>'
             + ''.join(f'<line x1="88" y1="{y}" x2="104" y2="{y}"/>' for y in (-106, -92, -78, -64)) + '</g>')
    # hazard placard
    b.append('<g transform="translate(-88,-78) rotate(45)"><rect x="-9" y="-9" width="18" height="18" fill="#ffd24a"/></g>')
    b.append(underframe(L, h - 52))
    b.append(truck(-h + 52, r=16, n=2, spacing=42) + truck(h - 52, r=16, n=2, spacing=42))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-tanker', '-150 -160 300 175', '  ' + ''.join(b),
         'TANK CAR', L, L / 2, 'wagon', 'Tank car')


def hopper():
    L = 235; h = L / 2
    b = [shadow(-h, h)]
    # sloped open-top gondola
    b.append(f'<path class="cc-wagon" d="M{-h+6},-112 L{h-6},-112 L{h-26},-48 L{-h+26},-48 Z" fill="#4a4f57"/>')
    b.append(f'<rect class="cc-wagon" x="{-h+2}" y="-118" width="{L-4}" height="10" rx="3" fill="#5b616a"/>')
    # ribs
    b.append('<g stroke="#2f343c" stroke-width="4">' + ''.join(
        f'<line x1="{-h+22+i*32}" y1="-108" x2="{-h+34+i*32}" y2="-52"/>' for i in range(6)) + '</g>')
    # coal load
    b.append('<rect x="' + str(-h+12) + '" y="-114" width="' + str(L-24) + '" height="10" fill="#20242a"/>')
    b.append('<g fill="#14161a">'
             f'<rect x="{-h+14}" y="-118" width="{L-28}" height="10" rx="3"/>'
             '<circle cx="-74" cy="-119" r="8"/><circle cx="-44" cy="-122" r="9.5"/><circle cx="-14" cy="-119" r="8"/>'
             '<circle cx="18" cy="-122" r="9.5"/><circle cx="50" cy="-119" r="8"/><circle cx="76" cy="-118" r="7"/></g>')
    b.append('<g fill="#333a44" opacity="0.85"><circle cx="-46" cy="-125" r="3"/><circle cx="16" cy="-125" r="2.6"/></g>')
    b.append(underframe(L, h - 50))
    b.append(truck(-h + 50, r=16, n=2, spacing=42) + truck(h - 50, r=16, n=2, spacing=42))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-hopper', '-142 -155 284 170', '  ' + ''.join(b),
         'OPEN HOPPER / GONDOLA with coal load', L, L / 2, 'wagon', 'Coal hopper')


def container():
    """Double-stack well car — tall and colourful."""
    L = 270; h = L / 2
    b = [shadow(-h, h)]
    b.append(f'<rect x="{-h+6}" y="-56" width="{L-12}" height="14" rx="3" fill="#3a4049"/>')
    b.append(f'<rect x="{-h+30}" y="-92" width="{L-60}" height="38" rx="3" fill="#2f343c"/>')
    # lower container (in the well)
    b.append(f'<rect class="cc-wagon" x="{-h+18}" y="-116" width="{L-36}" height="52" rx="3" fill="#2a6fd6"/>')
    b.append(ribs(-h + 24, h - 24, -114, -66, 16, '#000', 0.16))
    b.append(f'<rect x="{h-64}" y="-114" width="44" height="48" rx="2" fill="#000" opacity="0.14"/>')
    b.append(f'<text x="{-h+70}" y="-84" font-family="Trebuchet MS,sans-serif" font-size="17" '
             f'fill="#ffffff" opacity="0.85">CHUGA</text>')
    # upper container
    b.append(f'<rect class="cc-wagon2" x="{-h+14}" y="-172" width="{L-28}" height="54" rx="3" fill="#d9822b"/>')
    b.append(ribs(-h + 20, h - 20, -170, -122, 16, '#000', 0.16))
    b.append(f'<rect x="{-h+18}" y="-170" width="44" height="50" rx="2" fill="#000" opacity="0.14"/>')
    b.append(f'<text x="{h-96}" y="-140" font-family="Trebuchet MS,sans-serif" font-size="17" '
             f'fill="#3a2410" opacity="0.8">CHOCHO</text>')
    # corner castings
    b.append('<g fill="#8f98a3">' + ''.join(
        f'<rect x="{x}" y="{y}" width="12" height="7" rx="2"/>'
        for x in (-h + 14, h - 26) for y in (-176, -122)) + '</g>')
    b.append(underframe(L, h - 54))
    b.append(truck(-h + 54, r=16, n=2, spacing=42) + truck(h - 54, r=16, n=2, spacing=42))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-container', '-160 -200 320 215', '  ' + ''.join(b),
         'DOUBLE-STACK CONTAINER WELL CAR', L, L / 2, 'wagon', 'Container (double stack)')


def cane_tank():
    """Hawaiian sugar-cane plantation tank engine. Narrow-gauge, saddle tank over the
    boiler, big balloon spark-arrestor stack (cane trash burns and throws sparks — the
    stack is a fire precaution, not decoration), open-backed cab, and a wooden pilot.
    Deliberately small: it should look like it would fit in the diesel's cab."""
    L = 250; h = L / 2
    b = [shadow(-h - 6, h + 20)]
    # frame and running board
    b.append(f'<rect x="{-h+4}" y="-46" width="{L+8}" height="12" rx="3" fill="#2f2a26"/>')
    b.append(f'<rect x="{-h+4}" y="-50" width="{L+8}" height="5" rx="2" fill="#6b5c48"/>')
    # boiler
    b.append(f'<rect x="{-h+52}" y="-104" width="{L-70}" height="52" rx="14" fill="#2b3830"/>')
    b.append(f'<rect x="{-h+52}" y="-104" width="{L-70}" height="12" rx="6" fill="#35463b"/>')
    # smokebox at the front, with its door
    b.append(f'<rect x="{h-46}" y="-108" width="42" height="60" rx="10" fill="#1f2823"/>')
    b.append(f'<circle cx="{h-24}" cy="-78" r="19" fill="#2b3830"/>')
    b.append(f'<circle cx="{h-24}" cy="-78" r="15" fill="#1a221e"/>')
    b.append(f'<g class="cc-brass" fill="#d4a943"><circle cx="{h-24}" cy="-78" r="4.5"/>'
             f'<rect x="{h-26}" y="-96" width="4" height="36" rx="2"/></g>')
    # the saddle tank sitting over the boiler
    b.append(f'<rect class="cc-loco" x="{-h+46}" y="-126" width="{L-92}" height="46" rx="12" '
             f'fill="#2f6b45"/>')
    b.append(f'<rect x="{-h+46}" y="-126" width="{L-92}" height="12" rx="6" fill="#3a7f53"/>')
    b.append(f'<g class="cc-brass" fill="#d4a943">'
             f'<rect x="{-h+50}" y="-92" width="{L-100}" height="3"/>'
             f'<rect x="{-h+50}" y="-120" width="{L-100}" height="2.5"/></g>')
    # the balloon stack — the single most recognisable thing on a cane engine
    b.append(f'<rect x="{h-33}" y="-134" width="12" height="30" fill="#1f2823"/>')
    # the balloon: bulges out and back in. A straight cone with a cap is a factory
    # chimney; the bulge is the spark arrestor, and it is the whole silhouette.
    b.append(f'<path d="M{h-33},-132 C {h-56},-152 {h-58},-176 {h-42},-186 '
             f'L{h-12},-186 C {h+4},-176 {h+2},-152 {h-21},-132 Z" fill="#1f2823"/>')
    b.append(f'<path d="M{h-33},-132 C {h-56},-152 {h-58},-176 {h-42},-186 '
             f'L{h-33},-186 C {h-46},-174 {h-44},-152 {h-27},-132 Z" fill="#2b3830"/>')
    b.append(f'<rect x="{h-45}" y="-192" width="36" height="8" rx="3" fill="#2b3830"/>')
    b.append(f'<rect class="cc-brass" x="{h-45}" y="-196" width="36" height="5" rx="2" fill="#d4a943"/>')
    # steam dome, sand dome, whistle, bell
    b.append(f'<path d="M{-h+96},-126 C {-h+96},-146 {-h+128},-146 {-h+128},-126 Z" fill="#2b3830"/>')
    b.append(f'<rect class="cc-brass" x="{-h+100}" y="-150" width="24" height="7" rx="3" fill="#d4a943"/>')
    b.append(f'<g class="cc-brass" fill="#d4a943">'
             f'<rect x="{h-64}" y="-146" width="7" height="20" rx="3"/>'
             f'<path d="M{-h+140},-126 L{-h+156},-126 L{-h+152},-142 L{-h+144},-142 Z"/>'
             '</g>')
    b.append(f'<g class="cc-brass" fill="#d4a943">'
             f'<rect x="{-h+140}" y="-152" width="4" height="14" rx="2"/>'
             f'<rect x="{-h+156}" y="-152" width="4" height="14" rx="2"/>'
             f'<rect x="{-h+138}" y="-155" width="24" height="4" rx="2"/>'
             f'<path d="M{-h+142},-138 C {-h+142},-152 {-h+158},-152 {-h+158},-138 Z"/>'
             f'<rect x="{-h+140}" y="-139" width="20" height="4" rx="2"/></g>')
    # cab, open at the back the way plantation cabs are
    b.append(f'<rect class="cc-loco" x="{-h+4}" y="-140" width="62" height="92" rx="5" fill="#2f6b45"/>')
    b.append(f'<rect x="{-h+4}" y="-140" width="62" height="12" rx="5" fill="#3a7f53"/>')
    b.append(f'<rect x="{-h+14}" y="-128" width="24" height="28" rx="3" fill="#dff0f6"/>')
    b.append(f'<rect x="{-h+14}" y="-128" width="24" height="11" rx="3" fill="#eef8fc"/>')
    b.append(f'<rect x="{-h+4}" y="-96" width="62" height="30" fill="#1f2823" opacity="0.35"/>')
    b.append(f'<rect class="cc-roof" x="{-h-6}" y="-152" width="88" height="14" rx="5" fill="#8f3b32"/>')
    b.append(f'<rect class="cc-roof" x="{-h-6}" y="-152" width="88" height="5" rx="3" fill="#a34a3f"/>')
    # headlamp on the smokebox front
    b.append(f'<rect x="{h-14}" y="-124" width="22" height="20" rx="4" fill="#2b3830"/>')
    b.append(f'<circle cx="{h-3}" cy="-114" r="7" fill="#fff3c4"/>')
    # wooden pilot / cowcatcher
    b.append(f'<rect x="{h-2}" y="-50" width="16" height="14" rx="3" fill="#4f4438"/>')
    b.append(f'<path d="M{h+12},-48 L{h+34},-14 L{h+2},-14 L{h+2},-48 Z" fill="#6b5c48"/>')
    b.append(f'<path d="M{h+12},-48 L{h+34},-14 L{h+26},-14 L{h+6},-48 Z" fill="#8d7a5f"/>')
    b.append(f'<g stroke="#4f4438" stroke-width="2.2">'
             f'<line x1="{h+10}" y1="-40" x2="{h+10}" y2="-16"/>'
             f'<line x1="{h+18}" y1="-30" x2="{h+18}" y2="-16"/>'
             f'<line x1="{h+26}" y1="-22" x2="{h+26}" y2="-16"/></g>')
    # running gear: two drivers and a trailing wheel. No side rod on purpose — the
    # gallery's rod animation is pinned to the big steam loco's exact geometry, and a
    # rod that visibly does not move is worse than no rod at all.
    b.append(wheel(-h + 96, 22) + wheel(-h + 152, 22) + wheel(-h + 34, 13))
    b.append(f'<rect x="{-h+72}" y="-30" width="104" height="7" rx="3" fill="#2f343c"/>')
    b.append(coupler(-h - 2))
    emit('cane-tank', '-140 -205 300 225', '  ' + ''.join(b),
         'HAWAIIAN SUGAR-CANE PLANTATION TANK ENGINE', L, L / 2, 'engine',
         'Cane plantation tank engine')


def cane_car():
    """Open cane car: a low flat wagon with stake sides, piled with cut cane. These ran
    in strings of a dozen from the fields down to the mill."""
    L = 210; h = L / 2
    b = [shadow(-h, h)]
    # deck
    b.append(f'<rect x="{-h+4}" y="-58" width="{L-8}" height="14" rx="3" fill="#6b5c48"/>')
    b.append(f'<rect x="{-h+4}" y="-58" width="{L-8}" height="4" rx="2" fill="#8d7a5f"/>')
    # stake sides
    b.append('<g fill="#4f4438">' + ''.join(
        f'<rect x="{-h+12+i*24}" y="-108" width="7" height="52" rx="2"/>' for i in range(8)) + '</g>')
    b.append(f'<g fill="#5c5041"><rect x="{-h+8}" y="-104" width="{L-16}" height="5" rx="2"/>'
             f'<rect x="{-h+8}" y="-78" width="{L-16}" height="5" rx="2"/></g>')
    # the load: cut cane, stacked lengthways and spilling over the top
    b.append(f'<rect class="cc-wagon" x="{-h+10}" y="-98" width="{L-20}" height="42" rx="4" '
             f'fill="#9caf4e"/>')
    b.append('<g stroke="#b8c96a" stroke-width="2.6" stroke-linecap="round">' + ''.join(
        f'<line x1="{-h+16}" y1="{-94+i*7}" x2="{h-16}" y2="{-92+i*7}"/>' for i in range(6)) + '</g>')
    b.append('<g stroke="#7d8f3c" stroke-width="1.8" stroke-linecap="round">' + ''.join(
        f'<line x1="{-h+16}" y1="{-90+i*7}" x2="{h-16}" y2="{-88+i*7}"/>' for i in range(5)) + '</g>')
    b.append(f'<path d="M{-h+14},-98 C {-h+60},-116 {h-60},-116 {h-14},-98 Z" fill="#a8bb58"/>')
    b.append('<g stroke="#c2d276" stroke-width="2.2" stroke-linecap="round">' + ''.join(
        f'<line x1="{-h+22+i*26}" y1="-100" x2="{-h+46+i*26}" y2="-112"/>' for i in range(6)) + '</g>')
    # a few loose stalks poking out the end, because a full car never looks tidy
    b.append('<g stroke="#b8c96a" stroke-width="2.4" stroke-linecap="round">'
             f'<line x1="{h-20}" y1="-96" x2="{h+16}" y2="-104"/>'
             f'<line x1="{h-20}" y1="-88" x2="{h+12}" y2="-92"/></g>')
    b.append(underframe(L, h - 44, y=-44, h=9))
    b.append(truck(-h + 44, r=13, n=2, spacing=34) + truck(h - 44, r=13, n=2, spacing=34))
    b.append(coupler(-h) + coupler(h))
    emit('wagon-cane', '-125 -135 250 150', '  ' + ''.join(b),
         'OPEN SUGAR-CANE CAR', L, L / 2, 'wagon', 'Cane car (open)')


def monorail():
    """Las Vegas Strip monorail: a straddle-beam car, so it has no visible wheels — the
    running gear rides inside the beam. Drawn with a deep skirt down to the rail line and
    small guide wheels showing under it, which is what a straddle monorail looks like from
    the side. Rounded nose, one continuous window band, roof air-conditioning pods."""
    L = 430; h = L / 2
    b = [shadow(-h - 4, h + 8)]
    # deep skirt down to the running line, standing in for the beam
    b.append(f'<rect x="{-h+6}" y="-56" width="{L-12}" height="46" rx="6" fill="#39414c"/>')
    b.append(f'<rect x="{-h+6}" y="-56" width="{L-12}" height="8" rx="4" fill="#4a5460"/>')
    b.append('<g fill="#252b33">' + ''.join(
        f'<rect x="{-h+30+i*54}" y="-30" width="34" height="16" rx="4"/>' for i in range(7)) + '</g>')
    # guide wheels peeping out below the skirt
    b.append(''.join(wheel(x, 9, hub='#9aa2ab') for x in (-h + 66, -h + 106, h - 106, h - 66)))
    # body, with a rounded nose at the front
    b.append(f'<path class="cc-loco" d="M{-h+8},-140 L{h-52},-140 '
             f'C {h-14},-140 {h+4},-124 {h+4},-100 L{h+4},-52 L{-h+8},-52 Z" fill="#f2f4f6"/>')
    b.append(f'<path d="M{-h+8},-140 L{h-52},-140 C {h-14},-140 {h+4},-124 {h+4},-100 '
             f'L{h+4},-128 C {h-10},-146 {h-40},-148 {h-56},-148 L{-h+8},-148 Z" fill="#ffffff"/>')
    # the livery band — this is where the recolour lands
    b.append(f'<rect class="cc-trim" x="{-h+8}" y="-76" width="{L-4}" height="17" fill="#c0392b"/>')
    b.append(f'<rect x="{-h+8}" y="-59" width="{L-4}" height="3.5" fill="#8f2a20"/>')
    # door seams, drawn UNDER the window band so they don't cross the glass
    b.append('<g fill="#d2d7dd">' + ''.join(
        f'<rect x="{-h+52+i*104}" y="-138" width="2.5" height="82"/>'
        f'<rect x="{-h+86+i*104}" y="-138" width="2.5" height="82"/>' for i in range(4)) + '</g>')
    b.append('<g fill="#a3302a">' + ''.join(
        f'<rect x="{-h+52+i*104}" y="-76" width="2.5" height="17"/>'
        f'<rect x="{-h+86+i*104}" y="-76" width="2.5" height="17"/>' for i in range(4)) + '</g>')
    # one continuous window band, dark and glassy
    b.append(f'<path d="M{-h+22},-130 L{h-56},-130 C {h-26},-130 {h-8},-116 {h-8},-98 '
             f'L{h-8},-86 L{-h+22},-86 Z" fill="#2b3a46"/>')
    b.append(windows(-h + 26, h - 34, -126, -90, 7, gap=9, rx=4,
                     fill='#8fc4dd', top='#c2e2f0'))
    # the driver's screen at the nose, taller than the saloon glass
    b.append(f'<path d="M{h-46},-128 C {h-20},-128 {h-2},-114 {h-2},-96 L{h-2},-88 '
             f'L{h-46},-88 Z" fill="#a8d4e8"/>')
    b.append(f'<path d="M{h-46},-128 C {h-20},-128 {h-2},-114 {h-2},-96 '
             f'L{h-14},-98 C {h-18},-114 {h-30},-124 {h-46},-124 Z" fill="#d2ecf6"/>')
    # roof: air-conditioning pods and a cable duct
    b.append(f'<rect class="cc-roof" x="{-h+14}" y="-152" width="{L-70}" height="12" rx="5" '
             f'fill="#c8ced6"/>')
    b.append('<g fill="#aeb6c0">' + ''.join(
        f'<rect x="{-h+40+i*86}" y="-164" width="58" height="14" rx="5"/>' for i in range(4)) + '</g>')
    b.append('<g fill="#8f98a3">' + ''.join(
        f'<rect x="{-h+48+i*86}" y="-160" width="42" height="4" rx="2"/>' for i in range(4)) + '</g>')
    # headlamps in the nose
    b.append(f'<g fill="#fff3c4"><rect x="{h-16}" y="-70" width="16" height="8" rx="3"/></g>')
    b.append(f'<g fill="#f2c230" opacity="0.9"><rect x="{h-16}" y="-84" width="9" height="6" rx="2"/></g>')
    # doors — a monorail is all doors, they board fast
    # door seams — as thin frame lines, not translucent panels. Panels drawn over the
    # window band read as smudges on the glass.
    # articulation bellows at the rear, where the next car couples
    b.append(f'<rect x="{-h-6}" y="-136" width="18" height="80" rx="3" fill="#2f353d"/>')
    b.append('<g fill="#454d57">' + ''.join(
        f'<rect x="{-h-4}" y="{-132+i*14}" width="14" height="6" rx="2"/>' for i in range(6)) + '</g>')
    emit('monorail', '-230 -190 470 205', '  ' + ''.join(b),
         'LAS VEGAS STRIP MONORAIL (straddle-beam driving car)', L, L / 2, 'engine',
         'Monorail (Las Vegas)')


def monorail_car():
    """The middle car of the monorail set: same body, bellows at both ends, no cab."""
    L = 400; h = L / 2
    b = [shadow(-h - 4, h + 4)]
    b.append(f'<rect x="{-h+6}" y="-56" width="{L-12}" height="46" rx="6" fill="#39414c"/>')
    b.append(f'<rect x="{-h+6}" y="-56" width="{L-12}" height="8" rx="4" fill="#4a5460"/>')
    b.append('<g fill="#252b33">' + ''.join(
        f'<rect x="{-h+28+i*54}" y="-30" width="34" height="16" rx="4"/>' for i in range(6)) + '</g>')
    b.append(''.join(wheel(x, 9, hub='#9aa2ab') for x in (-h + 62, -h + 102, h - 102, h - 62)))
    b.append(f'<rect class="cc-wagon" x="{-h+8}" y="-140" width="{L-16}" height="88" rx="8" '
             f'fill="#f2f4f6"/>')
    b.append(f'<rect x="{-h+8}" y="-148" width="{L-16}" height="14" rx="7" fill="#ffffff"/>')
    b.append(f'<rect class="cc-trim" x="{-h+8}" y="-76" width="{L-16}" height="17" fill="#c0392b"/>')
    b.append(f'<rect x="{-h+8}" y="-59" width="{L-16}" height="3.5" fill="#8f2a20"/>')
    b.append('<g fill="#d2d7dd">' + ''.join(
        f'<rect x="{-h+48+i*100}" y="-138" width="2.5" height="82"/>'
        f'<rect x="{-h+82+i*100}" y="-138" width="2.5" height="82"/>' for i in range(4)) + '</g>')
    b.append('<g fill="#a3302a">' + ''.join(
        f'<rect x="{-h+48+i*100}" y="-76" width="2.5" height="17"/>'
        f'<rect x="{-h+82+i*100}" y="-76" width="2.5" height="17"/>' for i in range(4)) + '</g>')
    b.append(f'<rect x="{-h+22}" y="-130" width="{L-44}" height="44" rx="5" fill="#2b3a46"/>')
    b.append(windows(-h + 26, h - 26, -126, -90, 7, gap=9, rx=4,
                     fill='#8fc4dd', top='#c2e2f0'))
    b.append(f'<rect class="cc-roof" x="{-h+14}" y="-152" width="{L-28}" height="12" rx="5" '
             f'fill="#c8ced6"/>')
    b.append('<g fill="#aeb6c0">' + ''.join(
        f'<rect x="{-h+38+i*86}" y="-164" width="58" height="14" rx="5"/>' for i in range(4)) + '</g>')
    b.append('<g fill="#8f98a3">' + ''.join(
        f'<rect x="{-h+46+i*86}" y="-160" width="42" height="4" rx="2"/>' for i in range(4)) + '</g>')
    for s in (-1, 1):
        x = s * (h + 6) - (18 if s > 0 else 0)
        b.append(f'<rect x="{x - (0 if s > 0 else 12):.0f}" y="-136" width="18" height="80" rx="3" '
                 f'fill="#2f353d"/>')
    emit('wagon-monorail', '-215 -190 440 205', '  ' + ''.join(b),
         'LAS VEGAS MONORAIL (intermediate car)', L, L / 2, 'wagon', 'Monorail car')


# ------------------------------------------------------------------- run ----
diesel(); electric_hs(); commuter(); streetcar(); cable_car()
cane_tank(); monorail()
coach_old(); caboose(); coach_modern(); hs_coach()
boxcar(); tanker(); hopper(); container(); cane_car(); monorail_car(); autorack()

# steam is hand-authored; record it in the manifest so consists can use it
VEHICLES['steam'] = dict(file='steam.svg', kind='engine', label='Steam locomotive (coal)',
                         length=404, originFromRear=190)

(OUT / 'manifest.json').write_text(json.dumps({
    'note': 'Rolling stock. y=0 is the rail line, +x forward, vehicles face right. '
            'length = total length in local units; originFromRear = distance from the rear '
            'end to the local origin (use it to butt vehicles together into a consist).',
    'vehicles': VEHICLES,
}, indent=2))

print(f'wrote {len(VEHICLES)} vehicles + manifest.json into {OUT}')
for k, v in VEHICLES.items():
    print(f'  {k:22s} {v["kind"]:6s} len={v["length"]}')
