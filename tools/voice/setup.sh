#!/usr/bin/env bash
# Set up the voice build pipeline. Run once; nothing here ships with the game.
#
# WHAT IT INSTALLS (all of it gitignored, ~520 MB)
#   tools/voice/venv/    Piper (piper-tts) in a throwaway virtualenv
#   tools/voice/models/  the .onnx voice models named in VOICE.md
#
# You also need ffmpeg on PATH for the MP3 encode:  brew install ffmpeg
#
# The game itself needs NONE of this. It reads play/js/voice-en.js and
# play/js/voice-pl.js, which ARE committed. This is only needed to regenerate
# them — i.e. when a spoken string changes.
set -euo pipefail
cd "$(dirname "$0")/../.."

command -v ffmpeg >/dev/null || { echo "ffmpeg missing — run: brew install ffmpeg"; exit 1; }

python3 -m venv tools/voice/venv
tools/voice/venv/bin/pip install -q --upgrade pip
tools/voice/venv/bin/pip install -q piper-tts

mkdir -p tools/voice/models
B=https://huggingface.co/rhasspy/piper-voices/resolve/main

# The SHIPPING voices. Licences are recorded in VOICE.md — do not add a voice
# here without recording its licence there first. Several Piper voices are
# CC BY-NC-SA or research-only and cannot be shipped; see VOICE.md.
fetch() {   # fetch <hf-dir> <model-name>
  local d=$1 n=$2
  [ -f "tools/voice/models/$n.onnx" ] || curl -fsSL -o "tools/voice/models/$n.onnx" "$B/$d/$n.onnx"
  [ -f "tools/voice/models/$n.onnx.json" ] || curl -fsSL -o "tools/voice/models/$n.onnx.json" "$B/$d/$n.onnx.json"
  echo "  $n"
}
fetch en/en_GB/cori/high      en_GB-cori-high
fetch pl/pl_PL/mc_speech/medium pl_PL-mc_speech-medium

echo "done — now: python3 tools/gen-voice.py"
