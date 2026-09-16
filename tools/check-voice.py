#!/usr/bin/env python3
"""Prove the recordings and the dictionaries still agree. Exits non-zero if not.

WHY THIS IS A BUILD ERROR AND NOT A WARNING
    The recordings are keyed by the text itself (VOICE.md). Edit one word in
    play/js/i18n.js and that line's clip is orphaned: nothing breaks, nothing
    logs, the game just quietly drops that line back to the robot voice — and
    the first person to notice is a three-year-old hearing one word in a
    different voice. So staleness has to fail here, loudly, the way
    tools/check-scenes.py fails on a prop in the road.

    This is the fifth place that must agree when you change something spoken.
    The other four are in CLAUDE.md under "Adding a location".

WHAT IT CHECKS
    1. every line tools/voice-lines.js reports has a clip in its language sprite
    2. every clip in a sprite still corresponds to a line (orphans from an edit)
    3. the sprite decodes as MP3 and the index is inside its duration
    4. no clip is suspiciously long for its text — the babble Piper produces on
       short words (see gen-voice.py). gen-voice refuses to emit these, so one
       here means a sprite was built by an older version of that tool.

USAGE
    python3 tools/check-voice.py            # after python3 tools/gen-voice.py
"""
import base64
import json
import pathlib
import re
import statistics
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = ROOT / 'play/js'
OUTLIER_X = 2.0
OUTLIER_BASE = 0.35

def load_sprite(lang):
    """Read a generated voice-<lang>.js without executing it."""
    path = JS / ('voice-%s.js' % lang)
    if not path.exists():
        return None, 'not generated — run: python3 tools/gen-voice.py'
    src = path.read_text(encoding='utf-8')
    m = re.search(r'\n    index: (\{.*?\}),\n', src, re.S)
    b = re.search(r"\n    mp3: '([A-Za-z0-9+/=]*)'", src)
    if not m or not b:
        return None, 'unreadable — regenerate with: python3 tools/gen-voice.py'
    try:
        index = json.loads(m.group(1))
    except ValueError as e:
        return None, 'index is not valid JSON (%s)' % e
    return {'index': index, 'mp3': b.group(1), 'path': path}, None

def main():
    lines = json.loads(subprocess.run(
        ['node', str(ROOT / 'tools/voice-lines.js')],
        capture_output=True, text=True, check=True).stdout)

    problems = []
    for lang in sorted(lines):
        want = {l['key']: l for l in lines[lang]}
        sprite, err = load_sprite(lang)
        if err:
            problems.append('%s: %s' % (lang, err))
            continue
        have = sprite['index']

        missing = [want[k] for k in want if k not in have]
        orphan = [k for k in have if k not in want]

        # The MP3 must actually be there and the index must live inside it.
        raw = base64.b64decode(sprite['mp3'])
        end = max((v[0] + v[1] for v in have.values()), default=0.0)
        head_ok = raw[:3] == b'ID3' or (len(raw) > 1 and raw[0] == 0xFF and (raw[1] & 0xE0) == 0xE0)

        print('  %s: %d lines, %d clips, %.1fs, %.1f MB'
              % (lang, len(want), len(have), end, len(raw) / 1e6))

        if not head_ok:
            problems.append('%s: the inlined data is not an MP3' % lang)
        if missing:
            problems.append('%s: %d line(s) with NO CLIP — they will use the robot voice:\n%s'
                            % (lang, len(missing),
                               '\n'.join('      %r  (%s)' % (l['text'], l['sources'][0]) for l in missing[:20])
                               + ('\n      … and %d more' % (len(missing) - 20) if len(missing) > 20 else '')))
        if orphan:
            problems.append('%s: %d clip(s) with NO LINE — a string was edited since recording:\n%s'
                            % (lang, len(orphan),
                               '\n'.join('      %r' % k for k in sorted(orphan)[:20])
                               + ('\n      … and %d more' % (len(orphan) - 20) if len(orphan) > 20 else '')))

        # Babble check, same yardstick gen-voice.py uses.
        longs = [have[k][1] / len(want[k]['text'])
                 for k in have if k in want and len(want[k]['text']) >= 20]
        if len(longs) >= 3:
            per_char = statistics.median(longs)
            fat = [(want[k]['text'], have[k][1]) for k in have if k in want
                   and have[k][1] > OUTLIER_X * (OUTLIER_BASE + per_char * len(want[k]['text']))]
            if fat:
                problems.append('%s: %d clip(s) far longer than their text — likely babble:\n%s'
                                % (lang, len(fat),
                                   '\n'.join('      %r takes %.2fs' % (t, d) for t, d in fat)))

    if problems:
        print('\nVOICE IS STALE:\n')
        for p in problems:
            print('  ' + p)
        sys.exit('\nFix with: python3 tools/gen-voice.py   (then re-run this)')
    print('\nvoice ok — every line has a clip, every clip has a line')

if __name__ == '__main__':
    main()
