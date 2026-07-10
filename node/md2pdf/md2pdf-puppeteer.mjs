#!/usr/bin/env node
// md2pdf-puppeteer.mjs — Markdown/HTML to PDF via Puppeteer
// Usage:  node md2pdf-puppeteer.mjs input.md [output.pdf]
// Setup:  npm install puppeteer marked

import puppeteer from "puppeteer";
import { marked }  from "marked";
import { readFileSync, statSync } from "fs";
import { resolve, extname } from "path";

// ── Args ──────────────────────────────────────────────────────────
const [,, inp, outArg] = process.argv;
if (!inp) {
  console.error("Usage: node md2pdf-puppeteer.mjs <input.md|html> [output.pdf]");
  process.exit(1);
}

const ext  = extname(inp).toLowerCase();
const out  = outArg ?? inp.replace(/\.(md|mdx|html?)$/i, ".pdf");
const src  = readFileSync(inp, "utf-8");

// ── Preprocess: normalize 2-space indented blocks → 4-space ───────
function normalizeIndentedCode(text) {
  const lines = text.split("\n");
  const result = [];
  let prevBlank = true;
  for (const line of lines) {
    if (line === "") {
      prevBlank = true;
      result.push(line);
    } else if (prevBlank && line.startsWith("  ") && !line.startsWith("   ")) {
      result.push("  " + line);  // 2-space → 4-space
      prevBlank = false;
    } else {
      prevBlank = false;
      result.push(line);
    }
  }
  return result.join("\n");
}

// ── CSS ───────────────────────────────────────────────────────────
const CSS = `
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
`;

// ── MD/HTML → HTML string ─────────────────────────────────────────
let html;
if (ext === ".html" || ext === ".htm") {
  html = src;
} else {
  marked.use({ gfm: true, breaks: false });
  const body = marked.parse(normalizeIndentedCode(src));
  html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>${body}</body>
</html>`;
}

// ── Puppeteer → PDF ───────────────────────────────────────────────
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage();

  // FIX: use "load" instead of "networkidle0"
  // networkidle0 waits for no network activity for 500ms — self-contained
  // HTML strings never trigger this reliably in newer Chromium builds.
  await page.setContent(html, { waitUntil: "load" });

  await page.pdf({
    path:                resolve(out),
    format:              "Letter",
    margin:              { top: "0.7in", bottom: "0.7in",
                           left: "0.7in", right: "0.7in" },
    printBackground:     true,
    displayHeaderFooter: false,   // suppress date/URL headers
  });

  const sizeKb = Math.round(statSync(resolve(out)).size / 1024);
  console.log(`✓ ${out}  (${sizeKb} KB)`);
} finally {
  await browser.close();
}
