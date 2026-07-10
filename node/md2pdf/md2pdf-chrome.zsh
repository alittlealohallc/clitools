#!/usr/bin/env zsh
# md2pdf-chrome.zsh — Markdown/HTML to PDF via Chrome headless
# Usage: ./md2pdf-chrome.zsh input.md [output.pdf]
# Requires: pandoc (brew install pandoc), Google Chrome

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <input.md|html> [output.pdf]"
  exit 1
fi

INPUT="$1"
# Default output: replace extension with .pdf in same directory
OUTPUT="${2:-${INPUT:r}.pdf}"

[[ ! -f "$INPUT" ]] && { echo "Error: $INPUT not found"; exit 1; }
command -v pandoc &>/dev/null || { echo "Missing pandoc — brew install pandoc"; exit 1; }

# ── Chrome path ───────────────────────────────────────────────────
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -f "$CHROME" ]]; then
  CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
fi
if [[ ! -f "$CHROME" ]]; then
  echo "Chrome/Chromium not found. Update CHROME path in this script."
  exit 1
fi

# ── CSS ───────────────────────────────────────────────────────────
CSS='
body {
  font-family: Charter, Georgia, serif;
  font-size: 11pt; color: #000;
  line-height: 1.35; margin: 0; padding: 0;
}
h1 { font-size: 14pt; font-weight: bold; margin: 0 0 2pt 0; }
h2 {
  font-size: 11pt; font-weight: bold; text-transform: uppercase;
  border-bottom: 1px solid #000;
  margin: 8pt 0 2pt 0; padding-bottom: 1pt; letter-spacing: 0.04em;
}
p   { margin: 3pt 0; }
ul, ol { margin: 1pt 0 3pt 0; padding-left: 16pt; }
li  { margin: 0; }
hr  { border: none; border-top: 1px solid #000; margin: 5pt 0; }
table { width: 100%; border-collapse: collapse; margin: 3pt 0 5pt 0; }
td  { padding: 1pt 8pt 1pt 0; vertical-align: top; font-size: 10.5pt; }
td:first-child { width: 26%; font-weight: bold; }
pre {
  white-space: pre-wrap;
  word-break: break-all;
  font-family: Menlo, "Courier New", monospace;
  font-size: 9pt;
  background: #f5f5f5;
  padding: 5pt 8pt; border-radius: 2pt;
  margin: 3pt 0 6pt 0;
}
code { font-family: Menlo, "Courier New", monospace; font-size: 9pt;
       background: #f5f5f5; padding: 0 2pt; }
pre code { background: none; padding: 0; }
@page { margin: 0.7in; size: letter; }
'

# ── Temp dir ──────────────────────────────────────────────────────
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

TMP_HTML="$TMP/doc.html"
TMP_CSS="$TMP/style.css"
print -r -- "$CSS" > "$TMP_CSS"

# ── MD/HTML → HTML ────────────────────────────────────────────────
EXT="${INPUT:e:l}"   # lowercase extension
if [[ "$EXT" == "html" || "$EXT" == "htm" ]]; then
  cp "$INPUT" "$TMP_HTML"
else
  pandoc "$INPUT" \
    --from=markdown+smart \
    --to=html5 \
    --standalone \
    --css="$TMP_CSS" \
    --metadata title="" \
    -o "$TMP_HTML"
fi

# ── Build absolute output path WITHOUT realpath ───────────────────
# FIX: BSD realpath requires file to exist; build path manually instead
OUT_DIR="$(cd "$(dirname "$OUTPUT")"; pwd)"
OUT_BASE="$(basename "$OUTPUT")"
ABS_OUT="$OUT_DIR/$OUT_BASE"

# ── Chrome → PDF ──────────────────────────────────────────────────
# FIX: pass both header flags (compatibility across Chrome versions)
# FIX: 2>/dev/null already suppresses stderr so no deadlock risk in zsh
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --run-all-compositor-stages-before-draw \
  "--print-to-pdf=$ABS_OUT" \
  --print-to-pdf-no-header \
  --no-pdf-header-footer \
  "file://$TMP_HTML" \
  2>/dev/null

if [[ ! -f "$ABS_OUT" ]]; then
  echo "Error: Chrome ran but $ABS_OUT was not created."
  exit 1
fi

SIZE_KB=$(( $(wc -c < "$ABS_OUT") / 1024 ))
echo "✓ $OUTPUT  (${SIZE_KB} KB)"
