#!/usr/bin/env node
/**
 * doc-update
 * Review a docs library and update all files to the current frontmatter standard.
 * Operates non-destructively: only touches frontmatter, never body content.
 *
 * Modes:
 *   --audit      Scan and report only (no writes)
 *   --fix        Fix all auto-fixable issues silently
 *   --interactive  Walk each file with problems and ask what to do
 *
 * Usage:
 *   doc-update                             # interactive audit of auto-discovered docs
 *   doc-update --audit                     # report only, no writes
 *   doc-update --fix --force               # fix everything silently
 *   doc-update ./src/content/docs/legal    # scope to a sub-directory
 *   doc-update --status published --type legal --force  # bulk-set fields
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, basename, relative } from 'path';
import { program } from 'commander';
import pc from 'picocolors';

import {
  log, ask, confirm, choose, closeRL,
  resolveContentDir, findFiles,
  parseFrontmatter, serializeFrontmatter,
  buildFrontmatter, slugify, titleCase,
  safeWrite, TODAY,
  VALID_STATUSES, VALID_TYPES, KENT,
} from '../lib/common.js';

// ─── Field validators ─────────────────────────────────────────────────────────

const RULES = [
  {
    id: 'missing-title',
    check: fm => !fm.title,
    desc: 'Missing title',
    autoFix: (fm, filePath) => { fm.title = fm.title || titleCase(basename(filePath, '.mdx').replace('.md', '')); },
  },
  {
    id: 'missing-slug',
    check: fm => !fm.slug,
    desc: 'Missing slug',
    autoFix: fm => { if (fm.title) fm.slug = slugify(fm.title); },
  },
  {
    id: 'invalid-type',
    check: fm => !fm.type || !VALID_TYPES.includes(fm.type),
    desc: fm => `Invalid or missing type: "${fm.type || '(none)'}"`,
    autoFix: null, // requires human choice
  },
  {
    id: 'invalid-status',
    check: fm => !fm.status || !VALID_STATUSES.includes(fm.status),
    desc: fm => `Invalid or missing status: "${fm.status || '(none)'}"`,
    autoFix: fm => { if (!fm.status) fm.status = 'draft'; },
  },
  {
    id: 'missing-authors',
    check: fm => !fm.authors || !Array.isArray(fm.authors) || fm.authors.length === 0,
    desc: 'Missing authors array',
    autoFix: fm => { if (!fm.authors?.length) fm.authors = [KENT]; },
  },
  {
    id: 'legacy-author-string',
    check: fm => typeof fm.author === 'string',
    desc: fm => `Legacy author field (string): "${fm.author}"`,
    autoFix: fm => {
      fm.authors = [{ name: fm.author, title: 'Author', org: '', email: '' }];
      delete fm.author;
    },
  },
  {
    id: 'missing-created-date',
    check: fm => !fm.createdDate,
    desc: 'Missing createdDate',
    autoFix: fm => { fm.createdDate = TODAY; },
  },
  {
    id: 'missing-last-updated',
    check: fm => !fm.lastUpdatedDate,
    desc: 'Missing lastUpdatedDate',
    autoFix: fm => { fm.lastUpdatedDate = TODAY; },
  },
  {
    id: 'draft-mismatch',
    check: fm => fm.status === 'published' && fm.draft === true,
    desc: 'Status is "published" but draft is true',
    autoFix: fm => { fm.draft = false; if (!fm.publishDate) fm.publishDate = TODAY; },
  },
  {
    id: 'missing-editors',
    check: fm => fm.editors === undefined,
    desc: 'Missing editors field (should be empty array if none)',
    autoFix: fm => { fm.editors = []; },
  },
];

function auditFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const { fm, body } = parseFrontmatter(raw);
  if (!fm) return { filePath, fm: null, body: raw, issues: [{ id: 'no-frontmatter', desc: 'No frontmatter found', autoFix: null }] };

  const issues = RULES
    .filter(r => r.check(fm))
    .map(r => ({
      id: r.id,
      desc: typeof r.desc === 'function' ? r.desc(fm) : r.desc,
      autoFix: r.autoFix,
    }));

  return { filePath, fm, body, issues };
}

// ─── Fix application ──────────────────────────────────────────────────────────

function applyAutoFixes(result) {
  let changed = false;
  for (const issue of result.issues) {
    if (issue.autoFix) {
      issue.autoFix(result.fm, result.filePath);
      changed = true;
    }
  }
  if (changed) result.fm.lastUpdatedDate = TODAY;
  return changed;
}

// ─── Interactive per-file handler ─────────────────────────────────────────────

async function interactiveFixFile(result, opts) {
  log.section(basename(result.filePath));
  console.log(`  ${pc.dim(relative(process.cwd(), result.filePath))}`);

  if (result.issues.length === 0) {
    log.ok('No issues found.');
    return 'ok';
  }

  for (const issue of result.issues) {
    console.log(`  ${pc.yellow('⚠')} ${issue.desc}`);
  }

  const autoFixable = result.issues.filter(i => i.autoFix);
  const manualOnly  = result.issues.filter(i => !i.autoFix);

  let changed = false;

  if (autoFixable.length > 0) {
    const fix = await confirm(`Apply ${autoFixable.length} auto-fix(es)?`, true);
    if (fix) {
      autoFixable.forEach(i => i.autoFix(result.fm, result.filePath));
      result.fm.lastUpdatedDate = TODAY;
      changed = true;
    }
  }

  // Manual fixes
  for (const issue of manualOnly) {
    switch (issue.id) {
      case 'invalid-type': {
        const choice = await choose('Select document type', VALID_TYPES, 'article');
        result.fm.type = choice;
        result.fm.lastUpdatedDate = TODAY;
        changed = true;
        break;
      }
      case 'invalid-status': {
        const choice = await choose('Select status', VALID_STATUSES, 'draft');
        result.fm.status = choice;
        result.fm.draft  = choice !== 'published';
        if (choice === 'published' && !result.fm.publishDate) result.fm.publishDate = TODAY;
        result.fm.lastUpdatedDate = TODAY;
        changed = true;
        break;
      }
      case 'no-frontmatter': {
        const addFM = await confirm('Add frontmatter?', true);
        if (addFM) {
          const title = await ask('Title', titleCase(basename(result.filePath, '.mdx')));
          result.fm = buildFrontmatter({
            title,
            type: await choose('Type', VALID_TYPES, 'article'),
            status: 'draft',
            authors: [KENT],
          });
          result.body = result.body; // unchanged
          changed = true;
        }
        break;
      }
    }
  }

  if (!changed) { log.skip('No changes applied.'); return 'skip'; }

  const written = await safeWrite(result.filePath, serializeFrontmatter(result.fm, result.body), opts.force ?? false);
  return written ? 'ok' : 'skip';
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

function printAuditReport(results) {
  const clean   = results.filter(r => r.issues.length === 0);
  const dirty   = results.filter(r => r.issues.length > 0);
  const noFM    = dirty.filter(r => r.issues.some(i => i.id === 'no-frontmatter'));

  log.section(`Audit Report — ${results.length} files`);
  console.log(`  ${pc.green(`✓ ${clean.length} clean`)}  ${pc.yellow(`⚠ ${dirty.length} with issues`)}  ${pc.red(`✗ ${noFM.length} missing frontmatter`)}\n`);

  if (dirty.length === 0) return;

  for (const r of dirty) {
    console.log(`  ${pc.bold(basename(r.filePath))}  ${pc.dim(relative(process.cwd(), r.filePath))}`);
    for (const i of r.issues) {
      const fixable = i.autoFix ? pc.dim(' [auto-fixable]') : pc.red(' [manual]');
      console.log(`    ${pc.yellow('→')} ${i.desc}${fixable}`);
    }
    console.log('');
  }

  const autoAll = dirty.every(r => r.issues.every(i => i.autoFix));
  if (autoAll) {
    console.log(pc.dim(`  All issues are auto-fixable. Run with --fix to apply.\n`));
  } else {
    console.log(pc.dim(`  Some issues require manual intervention. Run with --interactive.\n`));
  }
}

// ─── CLI definition ───────────────────────────────────────────────────────────

program
  .name('doc-update')
  .description('Audit and update docs library frontmatter to current standard')
  .version('1.0.0')
  .argument('[paths...]', 'Files or directories to audit (default: auto-discover)')
  .option('--audit',                  'Report issues only, do not write any files')
  .option('--fix',                    'Apply all auto-fixable issues non-interactively')
  .option('--interactive',            'Walk each file with issues and prompt for decisions')
  .option('--status <status>',        'Bulk-set status on all matched files')
  .option('--type <type>',            'Bulk-set type on all matched files')
  .option('--add-tag <tag>',          'Append a tag to all matched files')
  .option('-f, --force',              'Write without confirmation prompts')
  .action(async (paths, opts) => {
    const cwd = process.cwd();

    // Default to interactive if no mode specified
    if (!opts.audit && !opts.fix && !opts.interactive) {
      opts.interactive = true;
    }

    // Collect targets
    let targets = [];
    if (paths.length === 0) {
      const docsDir = await resolveContentDir(cwd, undefined);
      targets = findFiles(docsDir, ['.md', '.mdx']);
    } else {
      for (const p of paths) {
        const abs = resolve(p);
        if (!existsSync(abs)) { log.warn(`Not found: ${p}`); continue; }
        if (statSync(abs).isDirectory()) {
          targets.push(...findFiles(abs, ['.md', '.mdx']));
        } else {
          targets.push(abs);
        }
      }
    }

    if (targets.length === 0) {
      log.warn('No .md / .mdx files found.'); closeRL(); process.exit(0);
    }

    log.section(`doc-update: scanning ${targets.length} file(s)`);

    // Audit all files
    const results = targets.map(auditFile);

    // Handle bulk overrides first
    let bulkChanged = false;
    for (const r of results) {
      if (!r.fm) continue;
      if (opts.status && VALID_STATUSES.includes(opts.status)) {
        r.fm.status = opts.status;
        r.fm.draft  = opts.status !== 'published';
        if (opts.status === 'published' && !r.fm.publishDate) r.fm.publishDate = TODAY;
        bulkChanged = true;
      }
      if (opts.type && VALID_TYPES.includes(opts.type)) {
        r.fm.type = opts.type;
        bulkChanged = true;
      }
      if (opts.addTag && r.fm.tags && !r.fm.tags.includes(opts.addTag)) {
        r.fm.tags.push(opts.addTag);
        bulkChanged = true;
      }
      if (bulkChanged) r.fm.lastUpdatedDate = TODAY;
    }

    // ── Audit mode ────────────────────────────────────────────────────────
    if (opts.audit) {
      printAuditReport(results);
      closeRL(); return;
    }

    // ── Fix mode ──────────────────────────────────────────────────────────
    let ok = 0, skipped = 0, failed = 0;

    if (opts.fix || bulkChanged) {
      for (const r of results) {
        if (!r.fm) { log.skip(`${basename(r.filePath)} — no frontmatter`); skipped++; continue; }
        const changed = applyAutoFixes(r) || bulkChanged;
        if (!changed && r.issues.filter(i => !i.autoFix).length === 0) { skipped++; continue; }
        try {
          const written = await safeWrite(
            r.filePath,
            serializeFrontmatter(r.fm, r.body),
            opts.force ?? false
          );
          if (written) ok++; else skipped++;
        } catch (err) {
          log.error(`${basename(r.filePath)}: ${err.message}`); failed++;
        }
      }
    }

    // ── Interactive mode ──────────────────────────────────────────────────
    if (opts.interactive) {
      const withIssues = results.filter(r => r.issues.length > 0);
      if (withIssues.length === 0) {
        log.ok('All files are clean — nothing to do.');
        closeRL(); return;
      }

      log.info(`${withIssues.length} file(s) need attention.`);
      const proceed = await confirm('Review each file interactively?', true);
      if (!proceed) { closeRL(); return; }

      for (const r of withIssues) {
        const result = await interactiveFixFile(r, opts);
        if (result === 'ok') ok++;
        else skipped++;
      }
    }

    closeRL();
    console.log(`\n  ${pc.green(`✓ ${ok} updated`)}  ${pc.yellow(`${skipped} skipped`)}  ${pc.red(`${failed} failed`)}\n`);
    if (failed > 0) process.exit(1);
  });

program.parseAsync(process.argv).catch(err => {
  log.error(err.message);
  closeRL();
  process.exit(1);
});
