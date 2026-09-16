#!/usr/bin/env python3
"""Record every spoken line with Piper and inline it into play/js/voice-<lang>.js.

WHY THIS EXISTS
    The browser's SpeechSynthesis is a different voice on every platform, none of
    them sound like they are talking to a three-year-old, and the ones that get a
    place name wrong get it wrong confidently. VOICE.md is the full argument. This
    tool replaces it with recordings, keeping SpeechSynthesis as the safety net.

WHAT IT EMITS
    CC.voice.en = { rate, mp3: '<base64>', index: { 'chicago': [12.34, 0.71], … } }
    One sprite per language plus a {key: [startSeconds, durationSeconds]} index,
    inlined as base64 exactly as tools/inline-assets.py inlines the scenes — so
    double-clicking play/index.html still works. play/js/voice-*.js IS committed;
    everything under tools/voice/ is not.

THE LINE LIST COMES FROM tools/voice-lines.js, never from a list in here.
    That is the only way the recordings cannot drift from the dictionaries. Run
    tools/check-voice.py to prove they have not.

THE SEAM PROBLEM, AND WHY THERE IS SO MUCH SILENCE
    Slicing an MP3 by timestamps taken from the source WAV does not land exactly:
    the encoder adds its own delay, and how much of it a decoder strips varies by
    browser. Get it wrong by 30ms and a child hears the tail of "blue" on the end
    of "red" — a bug that looks like bad playback code and is actually bad offsets.
    The fix is not precision, it is PADDING: every clip is separated by PAD
    seconds of silence, and each slice is widened by LEAD/TAIL into that silence.
    All the slop lands in silence and nothing is ever audible from a neighbour.
    The check at the end fails the build if the drift ever exceeds the padding.

USAGE
    tools/voice/setup.sh          # once: Piper + the voice models
    python3 tools/gen-voice.py    # whenever a spoken string changes
    python3 tools/check-voice.py  # proves the two agree
"""
import base64
import json
import pathlib
import shutil
import statistics
import struct
import subprocess
import sys
import tempfile
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE = ROOT / 'tools/voice'
PIPER = VOICE / 'venv/bin/piper'
MODELS = VOICE / 'models'
OUT = ROOT / 'play/js'

# ---- THE SHIPPING VOICES -------------------------------------------------
# Licences are recorded in VOICE.md. Do not add a language here without reading
# that section first: several Piper voices are CC BY-NC-SA or research-only and
# CANNOT be shipped, and the two mistakes look identical until someone checks.
VOICES = {
    'en': {'model': 'en_GB-cori-high',       'length_scale': 1.15},
    'pl': {'model': 'pl_PL-mc_speech-medium', 'length_scale': 1.15},
}

# WHY noise IS ZERO, AND WHY THAT IS NOT A STYLE CHOICE
#   Piper's default --noise_scale/--noise_w_scale make every render different.
#   For a build tool that is bad twice over: the output is not reproducible, and
#   on very short inputs the model RAMBLES — "red" came out as 1.4s, 2.3s and
#   4.2s on three runs, each one the word, a mumble, and the word again. At zero
#   the model is deterministic, so the same dictionary always gives the same
#   audio and the babble guard below can actually be trusted.
NOISE = ['--noise_scale', '0', '--noise_w_scale', '0']

# THE BABBLE GUARD. Even deterministic, a couple of short words come out as the
# word-mumble-word pattern above ("red" and "Moab" in en_GB-cori-high; none in
# pl_PL-mc_speech-medium). A trailing punctuation mark gives the model the
# sentence boundary it is missing and the render comes out clean and short. So:
# render bare, and if a line is more than OUTLIER_X times as long as a line of
# its length should be, retry with each of these appended and take the first
# that lands. The KEY never changes — only what Piper is fed.
VARIANTS = ['!', ',', '.', '?']
OUTLIER_X = 2.0     # times the expected duration before we call a render broken
OUTLIER_BASE = 0.35 # seconds of fixed overhead in "expected", for short words

PAD = 0.25          # silence between clips — absorbs MP3 encoder delay (see above)
LEAD = 0.03         # start each slice this early, inside the preceding silence
TAIL = 0.06         # and run it this long past the end, into the following silence
TRIM_DB = -45.0     # anything quieter than this at a clip's edges is silence
BITRATE = '64k'

def need(path, hint):
    if not path.exists():
        sys.exit('missing %s\n  → %s' % (path, hint))

def render(model, text, dest, length_scale):
    """One line, one WAV. --sentence_silence 0 because we add our own padding."""
    subprocess.run(
        [str(PIPER), '-m', str(MODELS / (model + '.onnx')), '-f', str(dest),
         '--length_scale', str(length_scale), '--sentence_silence', '0'] + NOISE,
        input=text.encode('utf-8'), check=True,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def wav_seconds(path):
    with wave.open(str(path), 'rb') as w:
        return w.getnframes() / float(w.getframerate())

def read_wav(path):
    with wave.open(str(path), 'rb') as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2:
            sys.exit('%s: expected 16-bit mono from Piper' % path)
        return w.getframerate(), memoryview(w.readframes(w.getnframes())).cast('h')

def trim(samples, rate):
    """Drop near-silence from both ends.

    Piper leaves a little room around an utterance. Left in, every clip starts
    with a beat of nothing and the game feels slow to answer a tap — which reads
    as lag, not as politeness. Measured in 10ms windows so a quiet consonant at
    the start of a word is not mistaken for silence."""
    floor = 32768 * (10 ** (TRIM_DB / 20.0))
    win = max(1, rate // 100)
    loud = lambda i: max((abs(v) for v in samples[i:i + win]), default=0) > floor
    n = len(samples)
    a, b = 0, n
    while a < n and not loud(a): a += win
    while b > a and not loud(max(a, b - win)): b -= win
    # Keep one window of the original quiet either side, so the word does not
    # start abruptly on its first sample.
    return samples[max(0, a - win):min(n, b + win)]

def expected(rate_per_char, text):
    """How long a line of this length ought to take, for this voice."""
    return OUTLIER_BASE + rate_per_char * len(text)

def pick_renders(lang, spec, lines, tmp):
    """Render every line, retrying the ones that came out as babble.

    Returns [(line, wav_path)] in order. Exits non-zero if any line could not be
    rendered sanely — a word that babbles must never reach a child quietly, and
    the only way to guarantee that is to refuse to build."""
    model, ls = spec['model'], spec['length_scale']
    print('  %s — %d lines with %s' % (lang, len(lines), model))
    got = []
    for i, line in enumerate(lines):
        w = tmp / ('%s-%04d.wav' % (lang, i))
        render(model, line['text'], w, ls)
        got.append([line, w, wav_seconds(w)])
        if (i + 1) % 50 == 0:
            print('    rendered %d/%d' % (i + 1, len(lines)))

    # Fit seconds-per-character on the LONG lines only. A long line never
    # babbles, so those are the honest sample; short ones are what we are
    # testing. Median, not mean, so one bad render cannot move the yardstick.
    longs = [d / len(l['text']) for l, _, d in got if len(l['text']) >= 20]
    per_char = statistics.median(longs) if len(longs) >= 3 else 0.07
    print('    %.0f ms/char (from %d long lines)' % (per_char * 1000, len(longs)))

    bad = []
    for rec in got:
        line, w, d = rec
        if d <= OUTLIER_X * expected(per_char, line['text']):
            continue
        # Suspicious. Try the punctuation variants and take the first sane one.
        for v in VARIANTS:
            alt = tmp / (w.stem + '-' + str(VARIANTS.index(v)) + '.wav')
            render(model, line['text'] + v, alt, ls)
            ad = wav_seconds(alt)
            if ad <= OUTLIER_X * expected(per_char, line['text']):
                print('    babble fixed: %r  %.2fs → %.2fs  (fed "%s%s")'
                      % (line['text'], d, ad, line['text'], v))
                rec[1], rec[2] = alt, ad
                break
        else:
            bad.append((line['text'], d, expected(per_char, line['text'])))

    if bad:
        print('\n  %s: %d line(s) render as babble and no variant fixed them:' % (lang, len(bad)))
        for t, d, e in bad:
            print('    %r took %.2fs, expected about %.2fs' % (t, d, e))
        sys.exit('  Refusing to build. Listen to these with tools/voice/setup.sh\'s piper,\n'
                 '  then either add a variant to VARIANTS or reword the string in i18n.js.')
    return [(l, w) for l, w, _ in got]

def build(lang, spec, lines, tmp):
    picks = pick_renders(lang, spec, lines, tmp)

    rate = None
    pcm = bytearray()
    index = {}
    silence = b''
    skipped = []

    for line, wav in picks:
        r, samples = read_wav(wav)
        if rate is None:
            rate = r
            silence = b'\x00\x00' * int(PAD * rate)
            pcm.extend(silence)          # leading pad, so clip 0 can take its LEAD
        elif r != rate:
            sys.exit('%s: %d Hz but the sprite is %d Hz — all clips must match'
                     % (line['key'], r, rate))
        samples = trim(samples, rate)
        if not len(samples):
            skipped.append(line['text'])  # no clip => speech.js uses the robot
            continue
        start = len(pcm) / 2.0 / rate
        pcm.extend(struct.pack('<%dh' % len(samples), *samples))
        dur = len(pcm) / 2.0 / rate - start
        # Widen into the silence either side. Both edges stay inside PAD, so a
        # slice can never reach a neighbouring word however the decoder rounds.
        index[line['key']] = [round(start - LEAD, 4), round(dur + LEAD + TAIL, 4)]
        pcm.extend(silence)

    if skipped:
        print('    WARNING silent render, no clip written: %s' % ', '.join(repr(t) for t in skipped))

    src = tmp / ('sprite-%s.wav' % lang)
    with wave.open(str(src), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(bytes(pcm))
    seconds = len(pcm) / 2.0 / rate

    # One loudnorm pass over the whole sprite, not per clip: Piper already
    # normalises each utterance, and per-clip loudness matching on a half-second
    # word pumps audibly.
    mp3 = tmp / ('sprite-%s.mp3' % lang)
    subprocess.run(['ffmpeg', '-y', '-i', str(src),
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-codec:a', 'libmp3lame', '-b:a', BITRATE, '-ac', '1',
                    '-ar', str(rate), str(mp3)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # THE CHECK THAT MATTERS. If the encoder shifted the timeline by more than
    # the padding can hide, the offsets are wrong and words will bleed.
    got = float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
         str(mp3)], capture_output=True, text=True, check=True).stdout.strip())
    drift = abs(got - seconds)
    if drift > PAD / 2:
        sys.exit('  %s: encoder shifted the timeline by %.3fs, more than PAD/2 (%.3fs).\n'
                 '  The offsets would bleed between words. Raise PAD and re-run.'
                 % (lang, drift, PAD / 2))

    data = mp3.read_bytes()
    print('    %.1fs of audio, %.0f KB mp3, drift %.0f ms, %d clips'
          % (seconds, len(data) / 1024, drift * 1000, len(index)))
    return rate, data, index, seconds

def emit(lang, rate, data, index, seconds):
    b64 = base64.b64encode(data).decode('ascii')
    dest = OUT / ('voice-%s.js' % lang)
    body = [
        '/* voice-%s.js — GENERATED by tools/gen-voice.py. DO NOT EDIT.' % lang,
        '',
        '   %d recorded lines, %.1fs of audio, one MP3 sprite inlined as base64 so' % (len(index), seconds),
        '   the game still runs from file://. `index` maps a normalised line — see',
        '   tools/voice-lines.js for the rule — to [startSeconds, durationSeconds].',
        '',
        '   Voice: %s. Licence: see VOICE.md.' % VOICES[lang]['model'],
        '   Regenerate with: python3 tools/gen-voice.py',
        '*/',
        '(function (CC) {',
        "  'use strict';",
        '  CC.voice = CC.voice || {};',
        "  CC.voice['%s'] = {" % lang,
        '    rate: %d,' % rate,
        '    index: %s,' % json.dumps(index, ensure_ascii=False, sort_keys=True),
        "    mp3: '%s'" % b64,
        '  };',
        '})(window.CC = window.CC || {});',
        '',
    ]
    dest.write_text('\n'.join(body), encoding='utf-8')
    print('    → %s (%.1f MB)' % (dest.relative_to(ROOT), dest.stat().st_size / 1e6))

def main():
    need(PIPER, 'run tools/voice/setup.sh')
    if not shutil.which('ffmpeg'): sys.exit('ffmpeg not on PATH — brew install ffmpeg')
    if not shutil.which('ffprobe'): sys.exit('ffprobe not on PATH — brew install ffmpeg')
    for lang, spec in VOICES.items():
        need(MODELS / (spec['model'] + '.onnx'), 'run tools/voice/setup.sh')

    lines = json.loads(subprocess.run(
        ['node', str(ROOT / 'tools/voice-lines.js')],
        capture_output=True, text=True, check=True).stdout)

    only = sys.argv[1:] or list(VOICES)
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        for lang in only:
            if lang not in VOICES: sys.exit('no voice configured for "%s"' % lang)
            if lang not in lines: sys.exit('no lines for "%s"' % lang)
            rate, data, index, secs = build(lang, VOICES[lang], lines[lang], tmp)
            emit(lang, rate, data, index, secs)
    print('\nnow run: python3 tools/check-voice.py')

if __name__ == '__main__':
    main()
