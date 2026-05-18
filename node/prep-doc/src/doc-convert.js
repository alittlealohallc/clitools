#!/usr/bin/env node
/**
 * doc-convert
 * Convert document files (.odt, .docx, .txt, .html, .rtf, .md) into MDX
 * with injected frontmatter, ready for Astro/Starlight.
 *
 * Usage:
 *   doc-convert file.odt
 *   doc-convert *.odt --output ./src/content/docs/guides --author kent
 *   doc-convert report.docx --template research --force
 */

import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, rmSync } from 'fs';
import { basename, extname, resolve, join } from 'path';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { program } from 'commander';
import pc from 'picocolors';

import {
  log, closeRL,
  checkExternalDeps, resolveContentDir,
  pickTemplate, collectMetadata,
  buildFrontmatter, serializeFrontmatter,
  slugify, titleCase, safeWrite,
  CONVERT_EXTS,
} from '../lib/common.js';

// ─── Pandoc conversion ────────────────────────────────────────────────────────

const FROM_MAP = {
  '.odt':  'odt',
  '.docx': 'docx',
  '.doc':  'docx',
  '.rtf':  'rtf',
  '.html': 'html',
  '.htm':  'html',
  '.txt':  'plain',
  '.md':   'commonmark',
};

/**
 * Convert a file to commonmark via pandoc. Returns raw markdown string.
 */
function pandocToString(inputPath) {
  const ext  = extname(inputPath).toLowerCase();
  const from = FROM_MAP[ext] ?? 'plain';
  const tmp  = join(tmpdir(), `doc-convert-${Date.now()}.md`);

  try {
    execFileSync('pandoc', ['-f', from, resolve(inputPath), '-t', 'commonmark', '-o', tmp], {
      stdio: 'pipe',
    });
    const result = readFileSync(tmp, 'utf8');
    rmSync(tmp);
    return result;
  } catch (err) {
    if (existsSync(tmp)) { try { rmSync(tmp); } catch { /* ignore */ } }
    throw err;
  }
}

// ─── Single file processor ────────────────────────────────────────────────────

async function processFile(inputPath, opts, outputDir) {
  const abs  = resolve(inputPath);
  const ext  = extname(abs).toLowerCase();
  const base = basename(abs, ext);
  const slug = slugify(base);

  if (!CONVERT_EXTS.has(ext)) {
    log.skip(`${basename(abs)} — unsupported format (${ext})`);
    return false;
  }
  if (!existsSync(abs)) {
    log.error(`File not found: ${abs}`);
    return false;
  }

  log.section(`Converting: ${basename(abs)}`);

  // Convert body
  let rawBody = '';
  try {
    rawBody = pandocToString(abs);
    log.ok('pandoc conversion complete');
  } catch (err) {
    log.error(`pandoc failed: ${err.message}`);
    log.info('Install pandoc:  brew install pandoc');
    return false;
  }

  // Pick template
  const { name: tmplName, content: tmplContent } = await pickTemplate(opts.template);

  // Collect metadata
  const meta = await collectMetadata(opts, titleCase(base));

  // Build frontmatter
  const fm = buildFrontmatter(meta);

  // Inject body into template {content} placeholder, strip any template frontmatter
  let body = tmplContent.replace(/^---[\s\S]*?---\n\n?/, '').trimStart();
  body = body.includes('{content}') ? body.replace(/\{content\}/g, rawBody) : body + '\n\n' + rawBody;

  const outPath = join(outputDir, `${slug}.mdx`);
  return safeWrite(outPath, serializeFrontmatter(fm, body), opts.force ?? false);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

program
  .name('doc-convert')
  .description('Convert documents (.odt, .docx, .txt, .html, .rtf, .md) to MDX with frontmatter')
  .version('1.0.0')
  .argument('<files...>', 'Input file(s) or directory to convert')
  .option('-o, --output <dir>',    'Output directory (default: auto-discover content/docs)')
  .option('-t, --template <name>', 'Template name from templates/ library')
  .option('--author <name>',       'Author preset ("kent" to auto-fill)')
  .option('--title <title>',       'Document title (skips prompt)')
  .option('--type <type>',         'Document type (article, how-to, reference, …)')
  .option('--status <status>',     'Workflow status (draft|review|published|archived)', 'draft')
  .option('--tags <tags>',         'Tags, space or comma separated')
  .option('-f, --force',           'Overwrite existing files without prompting')
  .action(async (files, opts) => {
    checkExternalDeps();

    const cwd       = process.cwd();
    const outputDir = await resolveContentDir(cwd, opts.output);

    let ok = 0, fail = 0, skip = 0;

    for (const pattern of files) {
      const abs    = resolve(pattern);
      const inputs = [];

      if (existsSync(abs) && statSync(abs).isDirectory()) {
        const walk = (d) => {
          for (const f of readdirSync(d)) {
            const full = join(d, f);
            if (statSync(full).isDirectory()) walk(full);
            else if (CONVERT_EXTS.has(extname(f).toLowerCase())) inputs.push(full);
          }
        };
        walk(abs);
      } else {
        inputs.push(abs);
      }

      for (const input of inputs) {
        const result = await processFile(input, opts, outputDir);
        if (result === true) ok++;
        else if (!existsSync(resolve(input))) fail++;
        else skip++;
      }
    }

    closeRL();
    console.log(`\n  ${pc.green(`✓ ${ok} converted`)}  ${pc.yellow(`${skip} skipped`)}  ${pc.red(`${fail} failed`)}\n`);
    if (fail > 0) process.exit(1);
  });

program.parseAsync(process.argv).catch(err => {
  log.error(err.message);
  closeRL();
  process.exit(1);
});
