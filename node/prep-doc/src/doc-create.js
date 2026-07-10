#!/usr/bin/env node
/**
 * doc-create
 * Scaffold a new MDX document from a template with injected frontmatter.
 * Moves/copies existing files into the docs structure too.
 *
 * Usage:
 *   doc-create                                     # fully interactive
 *   doc-create --template research --author kent   # skip most prompts
 *   doc-create --template tech-internal --category ddi --subcat bind
 *   doc-create --move ./drafts/notes.md --template how-to
 */

import { existsSync, mkdirSync, copyFileSync, renameSync, readFileSync } from 'fs';
import { resolve, join, basename, extname, relative } from 'path';
import { program } from 'commander';
import pc from 'picocolors';

import {
  log, ask, confirm, choose, closeRL,
  resolveContentDir,
  pickTemplate, listTemplates,
  collectMetadata, buildFrontmatter, serializeFrontmatter,
  slugify, titleCase, safeWrite,
  TODAY,
} from '../lib/common.js';

// ─── Directory resolution ─────────────────────────────────────────────────────

/**
 * Resolve the output file path within the docs tree.
 * Structure: <docsDir>/<category>/<subcat>/<slug>.mdx
 */
async function resolveOutputPath(docsDir, meta, opts) {
  let category = opts.category;
  let subcat   = opts.subcat ?? '';

  if (!category) {
    category = await ask('Category folder (e.g. guides, ddi, legal)', slugify(meta.type));
  }
  if (!subcat && !opts.force) {
    const s = await ask('Sub-category folder (or skip)', 'skip');
    subcat = s === 'skip' ? '' : s;
  }

  const catSlug  = slugify(category);
  const subSlug  = subcat ? slugify(subcat) : '';
  const targetDir = subSlug
    ? join(docsDir, catSlug, subSlug)
    : join(docsDir, catSlug);

  if (!existsSync(targetDir)) {
    const create = opts.force || await confirm(`Directory doesn't exist: ${relative(process.cwd(), targetDir)}\nCreate it?`, true);
    if (!create) { log.info('Aborted.'); closeRL(); process.exit(0); }
    mkdirSync(targetDir, { recursive: true });
    log.ok(`Created: ${relative(process.cwd(), targetDir)}`);
  }

  return join(targetDir, `${meta.slug}.mdx`);
}

// ─── Core: create from template ───────────────────────────────────────────────

async function createFromTemplate(opts) {
  const cwd = process.cwd();

  // ── Discover / choose docs dir ────────────────────────────────────────────
  const docsDir = await resolveContentDir(cwd, opts.output);

  // ── Pick template ─────────────────────────────────────────────────────────
  const { name: tmplName, content: tmplContent } = await pickTemplate(opts.template);
  log.info(`Template: ${pc.bold(tmplName)}`);

  // ── Collect metadata ──────────────────────────────────────────────────────
  const meta = await collectMetadata(opts);

  // ── Resolve output path ───────────────────────────────────────────────────
  const outputPath = await resolveOutputPath(docsDir, meta, opts);

  // ── Build content ─────────────────────────────────────────────────────────
  const fm   = buildFrontmatter(meta);
  // Strip frontmatter from template body if it has one
  const body = tmplContent.replace(/^---[\s\S]*?---\n\n?/, '').trimStart();
  const final = serializeFrontmatter(fm, body);

  // ── Write ─────────────────────────────────────────────────────────────────
  const written = await safeWrite(outputPath, final, opts.force ?? false);
  if (written) {
    log.section('Created successfully');
    console.log(`  ${pc.bold('File:')} ${outputPath}`);
    console.log(`  ${pc.bold('Title:')} ${meta.title}`);
    console.log(`  ${pc.bold('Type:')} ${meta.type} / ${pc.dim('status:')} ${meta.status}\n`);
  }
}

// ─── Core: move/copy existing file into docs ──────────────────────────────────

async function moveIntoDoc(sourcePath, opts) {
  const abs = resolve(sourcePath);
  if (!existsSync(abs)) {
    log.error(`Source file not found: ${abs}`);
    process.exit(1);
  }

  const cwd     = process.cwd();
  const docsDir = await resolveContentDir(cwd, opts.output);
  const ext     = extname(abs).toLowerCase();
  const isMDX   = ['.md', '.mdx'].includes(ext);

  log.section(`Moving: ${basename(abs)}`);

  // ── Pick template for wrapping ─────────────────────────────────────────────
  const { name: tmplName, content: tmplContent } = await pickTemplate(opts.template);

  // ── Read source ────────────────────────────────────────────────────────────
  let sourceContent = '';
  if (isMDX) {
    sourceContent = readFileSync(abs, 'utf8');
    // Strip existing frontmatter — we'll replace it
    sourceContent = sourceContent.replace(/^---[\s\S]*?---\n\n?/, '').trimStart();
  } else {
    log.warn('Non-MDX source: wrapping as raw content block.');
    sourceContent = readFileSync(abs, 'utf8');
  }

  // ── Collect metadata ──────────────────────────────────────────────────────
  const suggested = titleCase(basename(abs, ext));
  const meta = await collectMetadata(opts, suggested);

  // ── Resolve output path ───────────────────────────────────────────────────
  const outputPath = await resolveOutputPath(docsDir, meta, opts);

  // ── Build final content ───────────────────────────────────────────────────
  const fm = buildFrontmatter(meta);
  let body = tmplContent.replace(/^---[\s\S]*?---\n\n?/, '').trimStart();
  if (body.includes('{content}')) {
    body = body.replace(/\{content\}/g, sourceContent);
  } else {
    body = body + '\n\n' + sourceContent;
  }

  const final   = serializeFrontmatter(fm, body);
  const written = await safeWrite(outputPath, final, opts.force ?? false);

  if (written) {
    // Offer to remove source after copy
    if (!opts.copy) {
      const remove = opts.force || await confirm(`Remove original file? (${relative(cwd, abs)})`, false);
      if (remove) {
        const { unlinkSync } = await import('fs');
        unlinkSync(abs);
        log.ok(`Removed: ${relative(cwd, abs)}`);
      }
    }
    log.ok(`Done: ${outputPath}`);
  }
}

// ─── CLI definition ───────────────────────────────────────────────────────────

program
  .name('doc-create')
  .description('Scaffold a new MDX document or import an existing file into the docs structure')
  .version('1.0.0')
  .option('-t, --template <name>',    'Template name from templates/ library')
  .option('-o, --output <dir>',       'Target docs directory (auto-discovered if not set)')
  .option('-c, --category <name>',    'Category sub-folder (e.g. guides, legal, ddi)')
  .option('-s, --subcat <name>',      'Sub-category folder')
  .option('--title <title>',          'Document title')
  .option('--type <type>',            'Document type (article, how-to, research, …)')
  .option('--status <status>',        'Workflow status', 'draft')
  .option('--author <preset>',        'Author preset ("kent" to auto-fill)')
  .option('--tags <tags>',            'Tags, space or comma separated')
  .option('--version <ver>',          'Document version', '1.0.0')
  .option('--move <file>',            'Move/import an existing file into the docs structure')
  .option('--copy',                   'When using --move, keep the original file')
  .option('-f, --force',              'Skip confirmation prompts; overwrite existing files')
  .action(async (opts) => {
    if (opts.move) {
      await moveIntoDoc(opts.move, opts);
    } else {
      await createFromTemplate(opts);
    }
    closeRL();
  });

program.parseAsync(process.argv).catch(err => {
  log.error(err.message);
  closeRL();
  process.exit(1);
});
