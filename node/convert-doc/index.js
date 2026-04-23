#!/usr/bin/env node

/**
 * convert-doc.js
 * Convert documents + create new docs with frontmatter.
 * Replaces create-doc.zsh.
 *
 * Prerequisites:
 *   - pandoc      (for non-PDF formats; `pandoc` in PATH)
 *   - LibreOffice (`soffice` in PATH; used for PDF output and as fallback)
 *
 * Install: npm install
 * Usage:   node convert-doc.js --help
 */

import { program } from 'commander';
import { promises as fs, existsSync, statSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { glob } from 'glob';

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPPORTED_OUTPUT = ['md', 'mdx', 'txt', 'pdf', 'html', 'docx', 'odt', 'rst', 'epub'];

// Pandoc target format strings (PDF excluded — LibreOffice handles it)
const PANDOC_OUT_MAP = {
  md:   'commonmark',
  mdx:  'commonmark',
  txt:  'plain',
  html: 'html5',
  rst:  'rst',
  docx: 'docx',
  epub: 'epub',
};

// LibreOffice target formats
const LO_OUT_FORMATS = new Set(['pdf', 'html', 'docx', 'odt', 'txt']);

const INPUT_EXT_MAP = {
  odf:  ['.odt', '.ods', '.odp', '.odg', '.odf'],
  txt:  ['.txt'],
  md:   ['.md', '.mdx'],
  docx: ['.docx'],
  rtf:  ['.rtf'],
  html: ['.html', '.htm'],
  rst:  ['.rst'],
};

const DEFAULT_SCAN_EXTS = ['.odt', '.odf', '.txt'];

// Patterns to detect dates inside file text content
// Matches labels like: Created, Date, Published, Last Updated, Updated, Modified
const DATE_CREATED_RE  = /(?:created|date|published)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const DATE_UPDATED_RE  = /(?:last\s*updated?|updated?|modified)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleCase(str) {
  return str.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function commandExists(cmd) {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function detectInputFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  for (const [fmt, exts] of Object.entries(INPUT_EXT_MAP)) {
    if (exts.includes(ext)) return fmt;
  }
  return null;
}

/**
 * Normalise a messy date string to YYYY-MM-DD.
 * Accepts: YYYY-MM-DD, M/D/YYYY, D-M-YY, etc.
 */
function normaliseDate(raw) {
  if (!raw) return null;
  raw = raw.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Try JS Date parser (handles M/D/YYYY, etc.)
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return null;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Attempt to extract created + updated dates from plain text content.
 * Returns { createdDate, updatedDate } — either may be null.
 */
function extractDatesFromText(text) {
  const createdMatch = DATE_CREATED_RE.exec(text);
  const updatedMatch = DATE_UPDATED_RE.exec(text);
  return {
    createdDate: normaliseDate(createdMatch?.[1] ?? null),
    updatedDate: normaliseDate(updatedMatch?.[1] ?? null),
  };
}

/**
 * Try to read plain text from a file for date extraction.
 * Falls back to empty string if binary or unreadable.
 */
async function readTextSafe(filePath) {
  try {
    const buf = await fs.readFile(filePath);
    // Heuristic: if >15% of the first 512 bytes are non-printable, treat as binary
    const sample = buf.slice(0, 512);
    const nonPrintable = [...sample].filter(b => b < 9 || (b > 13 && b < 32)).length;
    if (nonPrintable / sample.length > 0.15) return '';
    return buf.toString('utf8');
  } catch { return ''; }
}

function hasFrontmatter(content) {
  return /^---\r?\n/.test(content.trimStart());
}

/**
 * Build YAML frontmatter block.
 * publishDate = date the doc came out of draft (null when still draft).
 * lastUpdatedDate = last modification date.
 */
function buildFrontmatter(title, tags = [], createdDate = null, updatedDate = null) {
  const dateStr     = createdDate ?? today();
  const updatedStr  = updatedDate ?? today();
  const tagsStr     = tags.map(t => `"${t}"`).join(', ');
  return [
    '---',
    `title: "${title}"`,
    `description: "Draft for ${title}"`,
    `publishDate: "${dateStr}"`,
    `lastUpdatedDate: "${updatedStr}"`,
    `author: "Kent Schaeffer"`,
    `draft: true`,
    `tags: [${tagsStr}]`,
    '---',
    '',
    '',
  ].join('\n');
}

// ─── File Collection ──────────────────────────────────────────────────────────

async function collectFiles(inputs, inputFormat) {
  const scanExts = inputFormat
    ? (INPUT_EXT_MAP[inputFormat.toLowerCase()] ?? [])
    : DEFAULT_SCAN_EXTS;

  const files = [];
  for (const raw of inputs) {
    const input = path.resolve(raw);
    if (!existsSync(input)) { console.error(`❌  Not found: ${input}`); continue; }
    if (statSync(input).isDirectory()) {
      for (const ext of scanExts) {
        const matches = await glob(`**/*${ext}`, { cwd: input, absolute: true, nodir: true });
        files.push(...matches);
      }
    } else {
      files.push(input);
    }
  }
  return [...new Set(files)].sort();
}

// ─── Conversion ───────────────────────────────────────────────────────────────

function pandocConvert(inputFile, outputFile, outputFmt) {
  const ext = path.extname(inputFile).toLowerCase();
  const fromMap = {
    '.odt': 'odt', '.odf': 'odt', '.docx': 'docx', '.rtf': 'rtf',
    '.html': 'html', '.htm': 'html', '.rst': 'rst',
    '.md': 'commonmark', '.mdx': 'commonmark', '.txt': 'plain',
  };
  const fromFlag  = fromMap[ext] ? `-f ${fromMap[ext]}` : '';
  const toFmt     = PANDOC_OUT_MAP[outputFmt] ?? outputFmt;
  const cmd = ['pandoc', fromFlag, `"${inputFile}"`, `-t ${toFmt}`, `-o "${outputFile}"`]
    .filter(Boolean).join(' ');
  execSync(cmd, { stdio: 'pipe' });
}

function loConvert(inputFile, outDir, outputFmt) {
  execSync(
    `soffice --headless --convert-to ${outputFmt} --outdir "${outDir}" "${inputFile}"`,
    { stdio: 'pipe' }
  );
}

// ─── Single-file Pipeline ─────────────────────────────────────────────────────

async function processFile(inputFile, opts) {
  const { outputFormat, outputDir, inputFormat, category, tags, repoRoot } = opts;

  if (!existsSync(inputFile)) { console.error(`❌  Not found: ${inputFile}`); return false; }

  // Input format mismatch warning
  if (inputFormat) {
    const expectedExts = INPUT_EXT_MAP[inputFormat.toLowerCase()] ?? [];
    const actualExt    = path.extname(inputFile).toLowerCase();
    if (!expectedExts.includes(actualExt)) {
      console.warn(`⚠️   ${path.basename(inputFile)}: extension '${actualExt}' ≠ --input-format '${inputFormat}'`);
    }
  }
  if (!detectInputFormat(inputFile)) {
    console.warn(`⚠️   ${path.basename(inputFile)}: unrecognised type — attempting anyway`);
  }

  // Resolve output path
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const slug     = slugify(baseName);
  const outExt   = outputFormat === 'mdx' ? '.mdx' : `.${outputFormat}`;
  let targetDir  = outputDir;

  if (category) {
    const catSlug = slugify(category);
    targetDir = repoRoot
      ? path.join(repoRoot, 'packages/docs/src/content/docs', catSlug)
      : path.join(outputDir, catSlug);

    if (!existsSync(targetDir)) {
      console.warn(`⚠️   Category folder '${catSlug}' does not exist.`);
      const ans = await ask(`   Create it? (y/n): `);
      if (!/^y/i.test(ans)) { console.log('   Skipped.'); return false; }
      await fs.mkdir(targetDir, { recursive: true });
      console.log(`✅  Created: ${targetDir}`);
    }
  }

  await fs.mkdir(targetDir, { recursive: true });
  const outputFile = path.join(targetDir, `${slug}${outExt}`);

  // Conflict check
  if (existsSync(outputFile)) {
    const ans = await ask(`⚠️   '${path.relative(process.cwd(), outputFile)}' exists. Overwrite? (y/n): `);
    if (!/^y/i.test(ans)) { console.log('   Skipped.'); return false; }
  }

  // Convert
  const hasPandoc = commandExists('pandoc');
  const hasLO     = commandExists('soffice');

  // Always use LibreOffice for PDF; use pandoc for everything else if available
  const useLO = outputFormat === 'pdf' ||
                (!hasPandoc && LO_OUT_FORMATS.has(outputFormat));

  try {
    if (!useLO && hasPandoc && PANDOC_OUT_MAP[outputFormat]) {
      pandocConvert(inputFile, outputFile, outputFormat);
    } else if (hasLO && LO_OUT_FORMATS.has(outputFormat)) {
      loConvert(inputFile, targetDir, outputFormat);
      // LibreOffice names output after source basename — rename if needed
      const loFile = path.join(targetDir, `${baseName}.${outputFormat}`);
      if (loFile !== outputFile && existsSync(loFile)) {
        await fs.rename(loFile, outputFile);
      }
    } else {
      throw new Error(
        `No converter available for '${outputFormat}'. Install ${!hasPandoc ? 'pandoc' : 'soffice (LibreOffice)'}.`
      );
    }

    if (!existsSync(outputFile)) throw new Error('Output file was not created.');
    console.log(`✅  ${path.basename(inputFile)} → ${path.relative(process.cwd(), outputFile)}`);
  } catch (err) {
    console.error(`❌  Conversion failed [${path.basename(inputFile)}]: ${err.message}`);
    return false;
  }

  // Frontmatter — always inject for text-based outputs; skip for binary formats
  const textOutputs = new Set(['md', 'mdx', 'txt', 'html', 'rst']);
  if (textOutputs.has(outputFormat)) {
    try {
      let content = await fs.readFile(outputFile, 'utf8');

      if (hasFrontmatter(content)) {
        console.log(`ℹ️   Frontmatter already present — skipping injection`);
      } else {
        // Try to pull dates from the original source file
        const srcText = await readTextSafe(inputFile);
        const { createdDate, updatedDate } = extractDatesFromText(srcText);

        const title = titleCase(baseName);
        const fm    = buildFrontmatter(title, tags ?? [], createdDate, updatedDate);
        await fs.writeFile(outputFile, fm + content, 'utf8');

        const dateNote = createdDate ? ` (publishDate: ${createdDate})` : '';
        console.log(`✅  Frontmatter injected${dateNote}`);
      }
    } catch (err) {
      console.error(`❌  Frontmatter injection failed: ${err.message}`);
      return false;
    }
  }

  return true;
}

// ─── --create Mode (replaces create-doc.zsh) ─────────────────────────────────

async function createDoc(category, title, tags = [], opts = {}) {
  const { repoRoot, outputDir, outputFormat } = opts;
  const ext      = outputFormat === 'mdx' ? '.mdx' : '.md';
  const catSlug  = slugify(category);
  const slug     = slugify(title);
  const date     = today();
  const tagsStr  = tags.map(t => `"${t}"`).join(', ');

  let targetDir = repoRoot
    ? path.join(repoRoot, 'packages/docs/src/content/docs', catSlug)
    : path.join(outputDir ?? './', catSlug);

  if (!existsSync(targetDir)) {
    console.warn(`⚠️   Category folder '${catSlug}' does not exist.`);
    const ans = await ask(`   Create it? (y/n): `);
    if (!/^y/i.test(ans)) { console.log('Aborted.'); process.exit(1); }
    await fs.mkdir(targetDir, { recursive: true });
    console.log(`✅  Created: ${targetDir}`);
  }

  const filePath = path.join(targetDir, `${slug}${ext}`);

  if (existsSync(filePath)) {
    const ans = await ask(`⚠️   '${path.relative(process.cwd(), filePath)}' exists. Overwrite? (y/n): `);
    if (!/^y/i.test(ans)) { console.log('Aborted.'); process.exit(1); }
  }

  const content = [
    '---',
    `title: "${title}"`,
    `description: "Draft for ${title}"`,
    `publishDate: "${date}"`,
    `lastUpdatedDate: "${date}"`,
    `author: "Kent Schaeffer"`,
    `draft: true`,
    `tags: [${tagsStr}]`,
    '---',
    '',
    `# ${title}`,
    '',
    '## Overview',
    '<!-- Start writing your content here -->',
    '',
    '## Technical Details',
    '<!-- Add code blocks, diagrams, or DDI config examples -->',
    '',
    '## References',
    '<!-- Link to related docs or external resources -->',
    '',
  ].join('\n');

  await fs.writeFile(filePath, content, 'utf8');
  console.log(`✅  Created: ${path.relative(process.cwd(), filePath)}`);
  console.log(`📝  Remember to set 'draft: false' when ready to publish.`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

program
  .name('convert-doc')
  .description('Convert or create docs with frontmatter, category support, and MDX output')
  .version('1.1.0')
  .argument('[inputs...]', 'Files and/or folders to convert (omit when using --create)')
  .option('-f, --format <fmt>',       `Output format [${SUPPORTED_OUTPUT.join('|')}]`, 'mdx')
  .option('-o, --out <dir>',          'Output directory (default: ./)', './')
  .option('-i, --input-format <fmt>', 'Expected input format [odf|txt|md|docx|rtf|html|rst] — warns on mismatch')
  .option('-c, --category <name>',    'Doc category → output goes to [out]/[category]/ or repo path')
  .option('-t, --tags <tags>',        'Space-separated tags, e.g. "api networking dns"')
  .option('-r, --repo <path>',        'Repo root → resolves category to packages/docs/src/content/docs/[category]')
  .option(
    '--create <title>',
    'Create a new blank doc (mirrors create-doc.zsh). Requires --category. --tags optional.'
  )
  .addHelpText('after', `
──────────────────────────────────────────────
 CONVERT mode (replaces manual pandoc/soffice calls)
──────────────────────────────────────────────
  # Single file → MDX (default)
  convert-doc report.odt

  # Folder → Markdown
  convert-doc ./drafts/ -f md -o ./output/

  # Multiple sources → HTML
  convert-doc file1.odt file2.txt ./more-docs/ -f html -o ./site/

  # MDX with category + tags
  convert-doc notes.txt -f mdx -c guides -t "api rest"

  # Full repo integration
  convert-doc notes.odt -f mdx -c networking -t "ddns vpn" -r ~/projects/www-alittlealoha-pro

  # PDF via LibreOffice
  convert-doc report.odt -f pdf -o ./exports/

──────────────────────────────────────────────
 CREATE mode (replaces create-doc.zsh)
──────────────────────────────────────────────
  convert-doc --create "Page Title" -c guides
  convert-doc --create "Page Title" -c networking -t "ddns vpn" -r ~/projects/www-alittlealoha-pro
`)
  .action(async (inputs, opts) => {
    // ── CREATE mode ──
    if (opts.create !== undefined) {
      if (!opts.category) {
        console.error('❌  --create requires --category');
        process.exit(1);
      }
      const tags = opts.tags ? opts.tags.split(/\s+/).filter(Boolean) : ['general'];
      await createDoc(opts.category, opts.create, tags, {
        repoRoot:     opts.repo   ? path.resolve(opts.repo)  : null,
        outputDir:    opts.out    ? path.resolve(opts.out)   : './',
        outputFormat: opts.format ?? 'mdx',
      });
      return;
    }

    // ── CONVERT mode ──
    if (!inputs || inputs.length === 0) {
      console.error('❌  Provide at least one file or folder, or use --create.');
      program.help();
    }

    const outputFormat = opts.format.toLowerCase();
    if (!SUPPORTED_OUTPUT.includes(outputFormat)) {
      console.error(`❌  Unknown output format: '${outputFormat}'`);
      console.error(`   Supported: ${SUPPORTED_OUTPUT.join(', ')}`);
      process.exit(1);
    }

    const tags  = opts.tags ? opts.tags.split(/\s+/).filter(Boolean) : [];
    const files = await collectFiles(inputs, opts.inputFormat);

    if (files.length === 0) { console.error('❌  No matching files found.'); process.exit(1); }

    console.log(`\n📄  ${files.length} file(s) → ${outputFormat.toUpperCase()}\n`);

    const convOpts = {
      outputFormat,
      outputDir:   path.resolve(opts.out),
      inputFormat: opts.inputFormat ?? null,
      category:    opts.category ?? null,
      tags,
      repoRoot:    opts.repo ? path.resolve(opts.repo) : null,
    };

    let ok = 0, fail = 0;
    for (const file of files) {
      (await processFile(file, convOpts)) ? ok++ : fail++;
    }

    console.log(`\n📊  Done — ${ok} succeeded, ${fail} failed`);
    if (fail > 0) process.exit(1);
  });

program.parse();
