#!/usr/bin/env python3
"""
md2pdf-chrome.py — Markdown/HTML to PDF via Chrome headless
Usage: python3 md2pdf-chrome.py input.md [output.pdf]
Requires: pip install markdown
          Google Chrome installed
"""

import sys, os, subprocess, tempfile, shutil, re

# ── Args ──────────────────────────────────────────────────────────
if len(sys.argv) < 2:
    print("Usage: python3 md2pdf-chrome.py <input.md|html> [output.pdf]")
    sys.exit(1)

inp = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else re.sub(r'\.(md|mdx|html?)$', '.pdf', inp)

if not os.path.isfile(inp):
    print(f"Error: file not found: {inp}", file=sys.stderr)
    sys.exit(1)

# ── Chrome path ───────────────────────────────────────────────────
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
]
CHROME = next((c for c in CHROME_CANDIDATES if os.path.isfile(c)), None)
if not CHROME:
    print("Error: Chrome/Chromium not found.", file=sys.stderr)
    sys.exit(1)

# ── CSS ───────────────────────────────────────────────────────────
CSS = """
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
h3 { font-size: 11pt; font-weight: bold; margin: 6pt 0 1pt 0; }
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
code {
  font-family: Menlo, "Courier New", monospace;
  font-size: 9pt; background: #f5f5f5; padding: 0 2pt;
}
pre code { background: none; padding: 0; }
@page { margin: 0.7in; size: letter; }
"""

# ── Preprocess: normalize 2-space indented blocks → 4-space ───────
def normalize_indented_code(text):
    """
    Markdown requires 4 spaces for indented code blocks.
    Some files use 2 spaces. This converts leading 2-space
    indented lines to 4-space so they render as <pre> blocks.
    Only applies to lines that are indented exactly 2 spaces
    following a blank line (standard code-block context).
    """
    lines = text.split('\n')
    result = []
    prev_blank = True
    for line in lines:
        if line == '':
            prev_blank = True
            result.append(line)
        elif prev_blank and line.startswith('  ') and not line.startswith('   '):
            # 2-space indent after blank line → expand to 4
            result.append('  ' + line)
            prev_blank = False
        else:
            prev_blank = False
            result.append(line)
    return '\n'.join(result)

# ── Convert MD or HTML → HTML string ─────────────────────────────
ext = os.path.splitext(inp)[1].lower()

if ext in ('.html', '.htm'):
    with open(inp, 'r', encoding='utf-8') as f:
        html = f.read()
else:
    with open(inp, 'r', encoding='utf-8') as f:
        md_text = f.read()

    md_text = normalize_indented_code(md_text)

    # Try python-markdown first, fall back to pandoc
    try:
        import markdown as md_lib
        # NOTE: codehilite removed — requires pygments separately
        body = md_lib.markdown(
            md_text,
            extensions=['tables', 'fenced_code', 'smarty', 'nl2br'],
        )
        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><style>{CSS}</style></head>
<body>{body}</body>
</html>"""

    except ImportError:
        # Fallback: pandoc (brew install pandoc)
        print("Note: 'markdown' not installed, using pandoc fallback.", file=sys.stderr)
        if not shutil.which('pandoc'):
            print("Error: neither 'markdown' (pip) nor 'pandoc' (brew) found.", file=sys.stderr)
            sys.exit(1)
        # Write temp md file with normalized content
        tmp_md = tempfile.NamedTemporaryFile(suffix='.md', mode='w',
                                             encoding='utf-8', delete=False)
        tmp_md.write(md_text)
        tmp_md.close()
        try:
            r = subprocess.run(
                ['pandoc', '--from=markdown+smart', '--to=html5', '--standalone',
                 f'--metadata=title:', tmp_md.name],
                capture_output=True, text=True
            )
        finally:
            os.unlink(tmp_md.name)

        if r.returncode != 0:
            print(f"Pandoc error: {r.stderr}", file=sys.stderr)
            sys.exit(1)
        # Inject CSS into pandoc's standalone HTML
        html = r.stdout.replace('</head>', f'<style>{CSS}</style>\n</head>', 1)

# ── Write temp HTML ───────────────────────────────────────────────
tmp = tempfile.mkdtemp()
try:
    tmp_html = os.path.join(tmp, 'doc.html')
    with open(tmp_html, 'w', encoding='utf-8') as f:
        f.write(html)

    abs_out = os.path.abspath(out)

    # ── Run Chrome ────────────────────────────────────────────────
    cmd = [
        CHROME,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--run-all-compositor-stages-before-draw',
        f'--print-to-pdf={abs_out}',
        '--print-to-pdf-no-header',
        '--no-pdf-header-footer',
        f'file://{tmp_html}',
    ]

    r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    if not os.path.isfile(abs_out) or os.path.getsize(abs_out) == 0:
        print(f"Error: PDF not created.", file=sys.stderr)
        if r.stderr:
            # Show first meaningful Chrome error line
            for line in r.stderr.decode(errors='replace').splitlines():
                if line.strip() and not line.startswith('['):
                    print(f"  Chrome: {line.strip()}", file=sys.stderr)
                    break
        sys.exit(1)

    size_kb = os.path.getsize(abs_out) // 1024
    print(f"✓ {out}  ({size_kb} KB)")

finally:
    shutil.rmtree(tmp, ignore_errors=True)
