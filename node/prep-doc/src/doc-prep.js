#!/usr/bin/env node
/**
 * doc-prep
 * Normalize, validate, and reformat the frontmatter of existing .md/.mdx files.
 * Does NOT change body content — only touches the YAML header.
 *
 * Use cases:
 *   - Stamp lastUpdatedDate on files you just edited
 *   - Migrate old 'author' (string) field to new 'authors' (array) format
 *   - Fill missing required fields interactively
 *   - Set status, version, tags in bulk
 *
 * Usage:
 *   doc-prep ./src/content/docs/guides/my-doc.mdx
 *   doc-prep ./src/content/docs --status published --force
 *   doc-prep . --stamp               (just update lastUpdatedDate on all .mdx)
 *   doc-prep file.mdx --add-tag dns  (append a tag without touching anything else)
 */

import { existsSync, statSync, readFileSync, writeFileSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { program } from 'commander';
import pc from 'picocolors';

import {
  log, ask, confirm, choose, closeRL,
  resolveContentDir, findFiles,
  parseFrontmatter, serializeFrontmatter, buildFrontmatter,
  slugify, titleCase, safeWrite,
  VALID_STATUSES, VALID_TYPES, TODAY, KENT,
} from '../lib/common.js';

// ─── Migration helpers ────────────────────────────────────────────────────────

/**
 * Migrate legacy 'author' string → 'authors' array.
 */
function migrateAuthor(fm) {
  if (fm.author && !fm.authors) {
    const name = String(fm.author);
    fm.authors = [{ name, title: 'Author', org: '', email: '' }];
    delete fm.author;
    return true;
  }
  return false;
}

/**
 * Migrate legacy 'draft: true/false' → status field.
 * Keeps draft for backward compat.
 */
function migrateDraft(fm) {
  if (fm.draft !== undefined && !fm.status) {
    fm.status = fm.draft ? 'draft' : 'published';
    return true;
  }
  return false;
}

/**
 * Ensure required fields exist. Returns list of missing field names.
 */
function missingRequired(fm) {
  const required = ['title', 'type', 'status', 'authors', 'createdDate', 'lastUpdatedDate'];
  return required.filter(k => {
    if (k === 'authors') return !fm.authors?.length;
    return !fm[k];
  });
}

// ─── Single file processor ────────────────────────────────────────────────────

async function processFile(filePath, opts) {
  const raw = readFileSync(filePath, 'utf8');
  const { fm, body } = parseFrontmatter(raw);

  if (!fm) {
    log.warn(`${basename(filePath)} — no frontmatter found, skipping`);
    return 'skip';
  }

  let changed = false;

  // ── --stamp: just update lastUpdatedDate ──────────────────────────────────
  if (opts.stamp) {
    if (fm.lastUpdatedDate !== TODAY) {
      fm.lastUpdatedDate = TODAY;
      changed = true;
    } else {
      log.skip(`${basename(filePath)} — lastUpdatedDate already today`);
      return 'skip';
    }
  }

  // ── Migrations (always run) ───────────────────────────────────────────────
  if (migrateAuthor(fm)) { changed = true; log.info('Migrated: author → authors'); }
  if (migrateDraft(fm))  { changed = true; log.info('Migrated: draft → status'); }

  // ── --status override ─────────────────────────────────────────────────────
  if (opts.status && VALID_STATUSES.includes(opts.status) && fm.status !== opts.status) {
    fm.status = opts.status;
    fm.draft  = opts.status !== 'published';
    if (opts.status === 'published' && !fm.publishDate) fm.publishDate = TODAY;
    fm.lastUpdatedDate = TODAY;
    changed = true;
  }

  // ── --add-tag ─────────────────────────────────────────────────────────────
  if (opts.addTag) {
    if (!fm.tags) fm.tags = [];
    if (!fm.tags.includes(opts.addTag)) {
      fm.tags.push(opts.addTag);
      fm.lastUpdatedDate = TODAY;
      changed = true;
    }
  }

  // ── --remove-tag ──────────────────────────────────────────────────────────
  if (opts.removeTag && fm.tags) {
    const before = fm.tags.length;
    fm.tags = fm.tags.filter(t => t !== opts.removeTag);
    if (fm.tags.length !== before) { fm.lastUpdatedDate = TODAY; changed = true; }
  }

  // ── --version ─────────────────────────────────────────────────────────────
  if (opts.version && fm.version !== opts.version) {
    fm.version = opts.version;
    fm.lastUpdatedDate = TODAY;
    changed = true;
  }

  // ── Interactive fill for missing required fields ───────────────────────────
  if (!opts.stamp && !opts.force) {
    const missing = missingRequired(fm);
    if (missing.length > 0) {
      log.section(`Missing required fields in: ${basename(filePath)}`);
      for (const field of missing) {
        switch (field) {
          case 'title': {
            const v = await ask('title', titleCase(basename(filePath, extname(filePath))));
            fm.title = v; fm.slug = fm.slug || slugify(v); changed = true; break;
          }
          case 'type': {
            fm.type = await choose('type', VALID_TYPES, 'article');
            changed = true; break;
          }
          case 'status': {
            fm.status = await choose('status', VALID_STATUSES, 'draft');
            fm.draft  = fm.status !== 'published';
            changed = true; break;
          }
          case 'authors': {
            const useKent = await confirm('Set author to Kent Schaeffer?', true);
            fm.authors = useKent ? [KENT] : [];
            changed = true; break;
          }
          case 'createdDate': {
            fm.createdDate = await ask('createdDate (YYYY-MM-DD)', TODAY);
            changed = true; break;
          }
          case 'lastUpdatedDate': {
            fm.lastUpdatedDate = TODAY;
            changed = true; break;
          }
        }
      }
    }
  }

  // ── Ensure slug exists ────────────────────────────────────────────────────
  if (!fm.slug && fm.title) {
    fm.slug = slugify(fm.title);
    changed = true;
  }

  if (!changed) {
    log.skip(`${basename(filePath)} — no changes needed`);
    return 'skip';
  }

  const newContent = serializeFrontmatter(fm, body);
  const didWrite   = await safeWrite(filePath, newContent, opts.force ?? false);
  return didWrite ? 'ok' : 'skip';
}

// ─── CLI definition ───────────────────────────────────────────────────────────

program
  .name('doc-prep')
  .description('Normalize and validate frontmatter in .md / .mdx files')
  .version('1.0.0')
  .argument('[paths...]', 'Files or directories to process (default: auto-discover)')
  .option('--stamp',                  'Only update lastUpdatedDate to today')
  .option('--status <status>',        'Set status on all matched files (draft|review|published|archived)')
  .option('--add-tag <tag>',          'Append a tag to all matched files')
  .option('--remove-tag <tag>',       'Remove a tag from all matched files')
  .option('--version <ver>',          'Set version field (e.g. 1.2.0)')
  .option('-f, --force',              'Write without confirmation prompts')
  .option('--dry-run',                'Show what would change without writing')
  .action(async (paths, opts) => {
    const cwd = process.cwd();

    // Collect target files
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
      log.warn('No .md / .mdx files found.');
      closeRL(); process.exit(0);
    }

    log.section(`doc-prep: ${targets.length} file(s) found`);
    if (opts.dryRun) log.warn('Dry-run mode — no files will be written.');

    let ok = 0, skipped = 0, failed = 0;

    for (const file of targets) {
      try {
        if (opts.dryRun) {
          const raw = readFileSync(file, 'utf8');
          const { fm } = parseFrontmatter(raw);
          const miss = fm ? missingRequired(fm) : ['no frontmatter'];
          if (miss.length) log.warn(`${basename(file)}: missing ${miss.join(', ')}`);
          else log.ok(`${basename(file)}: OK`);
          continue;
        }

        const result = await processFile(file, opts);
        if (result === 'ok') ok++;
        else skipped++;
      } catch (err) {
        log.error(`${basename(file)}: ${err.message}`);
        failed++;
      }
    }

    closeRL();
    if (!opts.dryRun) {
      console.log(`\n  ${pc.green(`✓ ${ok} updated`)}  ${pc.yellow(`${skipped} skipped`)}  ${pc.red(`${failed} failed`)}\n`);
    }
    if (failed > 0) process.exit(1);
  });

// expose for doc-update to import
export { processFile, missingRequired };

program.parseAsync(process.argv).catch(err => {
  log.error(err.message);
  closeRL();
  process.exit(1);
});
