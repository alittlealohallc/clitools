/**
 * lib/common.js
 * Shared utilities for all prep-doc CLI tools.
 * All functions are pure where possible; side-effects are explicit.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import { createInterface }  from 'readline';
import { execSync, execFileSync } from 'child_process';
import { homedir, platform } from 'os';
import yaml from 'js-yaml';
import pc from 'picocolors';

// ─── Module-level paths ──────────────────────────────────────────────────────

export const __filename = fileURLToPath(import.meta.url);
export const __dirname  = dirname(__filename);
export const TOOLS_ROOT = resolve(__dirname, '..');
export const TEMPLATE_DIR = join(TOOLS_ROOT, 'templates');

// ─── Constants ───────────────────────────────────────────────────────────────

export const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export const VALID_STATUSES  = ['draft', 'review', 'published', 'archived'];
export const VALID_TYPES     = [
  'article', 'blog', 'business-plan', 'checklist', 'design',
  'how-to', 'hr', 'invoice', 'legal', 'marketing-plan',
  'plan', 'proposal', 'reference', 'report', 'research',
  'rfc', 'runbook', 'agreement',
];

export const KENT = {
  name:  'Kent Schaeffer',
  title: 'Author',
  org:   'A Little Aloha LLC',
  url:   'https://alittlealoha.pro',
  email: 'kent@alittlealoha.pro',
};

// Source formats pandoc can handle that we care about
export const CONVERT_EXTS = new Set(['.odt', '.docx', '.doc', '.rtf', '.txt', '.html', '.htm', '.md']);

// ─── Logging ─────────────────────────────────────────────────────────────────

export const log = {
  info:    (...a) => console.log(pc.cyan('  info'), ...a),
  ok:      (...a) => console.log(pc.green('    ok'), ...a),
  warn:    (...a) => console.log(pc.yellow('  warn'), ...a),
  error:   (...a) => console.error(pc.red(' error'), ...a),
  prompt:  (...a) => process.stdout.write(pc.magenta('     ? ') + a.join(' ')),
  section: (...a) => console.log('\n' + pc.bold(pc.white(a.join(' ')))),
  skip:    (...a) => console.log(pc.dim('  skip'), ...a),
};

// ─── Interactive helpers ──────────────────────────────────────────────────────

let _rl = null;

function getRL() {
  if (!_rl) {
    _rl = createInterface({ input: process.stdin, output: process.stdout });
  }
  return _rl;
}

export function closeRL() {
  if (_rl) { _rl.close(); _rl = null; }
}

/**
 * Ask a single question on stdin. Returns trimmed answer or defaultValue.
 * @param {string} question
 * @param {string} [defaultValue='']
 * @returns {Promise<string>}
 */
export function ask(question, defaultValue = '') {
  return new Promise(resolve => {
    const hint = defaultValue ? pc.dim(` (${defaultValue})`) : '';
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pc.magenta('     ? ') + question + hint + ': ', ans => {
      rl.close();
      resolve(ans.trim() || defaultValue);
    });
  });
}

/**
 * Ask a yes/no question. Returns boolean.
 */
export async function confirm(question, defaultYes = false) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const ans = await ask(`${question} [${hint}]`, defaultYes ? 'y' : 'n');
  return /^y/i.test(ans);
}

/**
 * Present a numbered menu of choices. Returns chosen item.
 * @param {string} label
 * @param {string[]} choices
 * @param {string} [defaultChoice]
 * @returns {Promise<string>}
 */
export async function choose(label, choices, defaultChoice) {
  console.log(pc.magenta('\n     ? ') + label);
  choices.forEach((c, i) => {
    const marker = c === defaultChoice ? pc.green('►') : ' ';
    console.log(`  ${marker} ${pc.dim(String(i + 1).padStart(2))}. ${c}`);
  });
  const defaultIdx = defaultChoice ? String(choices.indexOf(defaultChoice) + 1) : '1';
  const ans = await ask(`Choice (1-${choices.length})`, defaultIdx);
  const idx = parseInt(ans, 10) - 1;
  if (idx >= 0 && idx < choices.length) return choices[idx];
  log.warn('Invalid choice, using default.');
  return defaultChoice ?? choices[0];
}

// ─── System utilities ─────────────────────────────────────────────────────────

/**
 * Returns true if a CLI binary exists in PATH.
 */
export function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check for required external dependencies (pandoc, optionally libreoffice).
 * Exits with instructions if nothing is available.
 */
export function checkExternalDeps() {
  const hasPandoc = commandExists('pandoc');
  const hasLO     = commandExists('soffice');

  if (!hasPandoc && !hasLO) {
    log.error('Neither pandoc nor LibreOffice (soffice) found in PATH.');
    console.log(pc.dim('\n  Install pandoc (recommended):'));
    console.log(pc.dim('    brew install pandoc'));
    console.log(pc.dim('\n  Or LibreOffice:'));
    console.log(pc.dim('    brew install --cask libreoffice\n'));
    process.exit(1);
  }
  return { hasPandoc, hasLO };
}

// ─── Content-docs discovery ───────────────────────────────────────────────────

const CONTENT_DOCS_CANDIDATES = [
  'src/content/docs',
];

// Also check packages/*/src/content/docs
function findMonorepoContentDirs(cwd) {
  const pkgDir = join(cwd, 'packages');
  if (!existsSync(pkgDir)) return [];
  const results = [];
  try {
    for (const entry of readdirSync(pkgDir)) {
      const candidate = join(pkgDir, entry, 'src', 'content', 'docs');
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        results.push(candidate);
      }
    }
  } catch { /* non-fatal */ }
  return results;
}

/**
 * Discover content/docs directories relative to cwd.
 * Returns absolute paths.
 * @param {string} [cwd=process.cwd()]
 * @returns {string[]}
 */
export function discoverContentDirs(cwd = process.cwd()) {
  const found = [];

  for (const rel of CONTENT_DOCS_CANDIDATES) {
    const abs = join(cwd, rel);
    if (existsSync(abs) && statSync(abs).isDirectory()) found.push(abs);
  }

  found.push(...findMonorepoContentDirs(cwd));

  // Deduplicate
  return [...new Set(found)];
}

/**
 * Resolve the target content/docs directory interactively if ambiguous.
 * @param {string} [cwd]
 * @param {string} [forcedPath]  -- from --output CLI flag
 * @returns {Promise<string>}
 */
export async function resolveContentDir(cwd, forcedPath) {
  if (forcedPath) {
    const abs = resolve(forcedPath);
    if (!existsSync(abs)) mkdirSync(abs, { recursive: true });
    return abs;
  }

  const dirs = discoverContentDirs(cwd);

  if (dirs.length === 0) {
    log.warn('No src/content/docs directory found in current tree.');
    const manual = await ask('Enter target docs path', join(cwd, 'src', 'content', 'docs'));
    const abs = resolve(manual);
    mkdirSync(abs, { recursive: true });
    return abs;
  }

  if (dirs.length === 1) {
    log.info(`Using docs dir: ${pc.underline(relative(cwd, dirs[0]))}`);
    return dirs[0];
  }

  // Multiple — ask
  const relative_dirs = dirs.map(d => relative(cwd, d));
  const chosen = await choose('Multiple content/docs directories found. Which one?', relative_dirs);
  return resolve(cwd, chosen);
}

// ─── Template handling ────────────────────────────────────────────────────────

/**
 * List available templates by scanning TEMPLATE_DIR.
 * @returns {{ name: string, path: string }[]}
 */
export function listTemplates() {
  if (!existsSync(TEMPLATE_DIR)) return [];
  return readdirSync(TEMPLATE_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => ({ name: basename(f, '.mdx'), path: join(TEMPLATE_DIR, f) }));
}

/**
 * Load a template file by name. Falls back gracefully.
 * @param {string} name  e.g. 'research', 'tech-internal'
 * @returns {string}  raw template content
 */
export function loadTemplate(name) {
  const path = join(TEMPLATE_DIR, `${name}.mdx`);
  if (existsSync(path)) return readFileSync(path, 'utf8');

  log.warn(`Template '${name}.mdx' not found in ${TEMPLATE_DIR}.`);
  log.info('Available: ' + listTemplates().map(t => t.name).join(', '));
  return null;
}

/**
 * Interactively pick a template from the library.
 * @returns {Promise<{ name: string, content: string }>}
 */
export async function pickTemplate(hint) {
  const templates = listTemplates();
  if (templates.length === 0) {
    log.error(`No templates found in ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  if (hint) {
    const match = templates.find(t => t.name === hint);
    if (match) return { name: match.name, content: readFileSync(match.path, 'utf8') };
    log.warn(`Template '${hint}' not found, prompting for selection.`);
  }

  const names = templates.map(t => t.name);
  const chosen = await choose('Select a template', names);
  const tmpl = templates.find(t => t.name === chosen);
  return { name: tmpl.name, content: readFileSync(tmpl.path, 'utf8') };
}

// ─── Frontmatter utilities ────────────────────────────────────────────────────

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse frontmatter from MDX/MD string.
 * @returns {{ fm: object|null, body: string }}
 */
export function parseFrontmatter(content) {
  const match = content.match(FM_REGEX);
  if (!match) return { fm: null, body: content };
  try {
    const fm = yaml.load(match[1]) ?? {};
    const body = content.slice(match[0].length);
    return { fm, body };
  } catch {
    return { fm: null, body: content };
  }
}

/**
 * Serialize an object back to YAML frontmatter + body string.
 */
export function serializeFrontmatter(fm, body) {
  const fmStr = yaml.dump(fm, { lineWidth: 120, quotingType: '"', forceQuotes: false });
  return `---\n${fmStr}---\n\n${body.trimStart()}`;
}

/**
 * Build a fresh frontmatter object from collected metadata.
 */
export function buildFrontmatter(meta) {
  return {
    title:               meta.title      || '',
    slug:                meta.slug       || slugify(meta.title || 'untitled'),
    description:         meta.description || '',
    type:                meta.type       || 'article',
    status:              meta.status     || 'draft',
    draft:               meta.status !== 'published',
    authors:             meta.authors    || [KENT],
    editors:             meta.editors    || [],
    tags:                meta.tags       || [],
    createdDate:         meta.createdDate      || TODAY,
    publishDate:         meta.publishDate      || '',
    lastUpdatedDate:     meta.lastUpdatedDate  || TODAY,
    nextReviewDate:      meta.nextReviewDate   || '',
    version:             meta.version          || '1.0.0',
    ...(meta.abstract         ? { abstract:         meta.abstract }         : {}),
    ...(meta.keywords?.length ? { keywords:         meta.keywords }         : {}),
    ...(meta.doi              ? { doi:              meta.doi }              : {}),
    ...(meta.license          ? { license:          meta.license }          : {}),
    ...(meta.limitation_of_liability !== undefined
      ? { limitation_of_liability: meta.limitation_of_liability } : {}),
    ...(meta.mermaid_diagram  ? { mermaid_diagram:  meta.mermaid_diagram }  : {}),
    ...(meta.prerequisites?.length ? { prerequisites:  meta.prerequisites } : {}),
    ...(meta.summary          ? { summary:          meta.summary }          : {}),
  };
}

// ─── Metadata collection (interactive) ───────────────────────────────────────

/**
 * Collect document metadata interactively, respecting CLI flags.
 * @param {object} opts  parsed Commander options
 * @param {string} [suggestedTitle]
 * @returns {Promise<object>}
 */
export async function collectMetadata(opts, suggestedTitle = '') {
  const force  = opts.force  ?? false;
  const isKent = opts.author === 'kent' || opts.author === 'Kent';

  const meta = {};

  // ── Title ──────────────────────────────────────────────────────────────────
  if (opts.title) {
    meta.title = opts.title;
  } else if (force) {
    meta.title = suggestedTitle || 'Untitled Document';
  } else {
    meta.title = await ask('Document title', suggestedTitle || 'Untitled Document');
    if (meta.title === 'x' || meta.title === 'exit') {
      log.info('Aborted.'); closeRL(); process.exit(0);
    }
  }

  meta.slug = slugify(meta.title);

  // ── Type ───────────────────────────────────────────────────────────────────
  if (opts.type && VALID_TYPES.includes(opts.type)) {
    meta.type = opts.type;
  } else if (!force) {
    meta.type = await choose('Document type', VALID_TYPES, 'article');
  } else {
    meta.type = 'article';
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  meta.status = opts.status ?? 'draft';

  // ── Authors ────────────────────────────────────────────────────────────────
  if (isKent) {
    meta.authors = [KENT];
  } else if (force) {
    meta.authors = [KENT];
  } else {
    const useKent = await confirm('Use Kent Schaeffer as primary author?', true);
    if (useKent) {
      meta.authors = [KENT];
    } else {
      const name  = await ask('Author name');
      if (!name || name === 'skip') {
        meta.authors = [];
      } else {
        const title = await ask('Author title', 'Author');
        const org   = await ask('Organization', 'A Little Aloha LLC');
        const email = await ask('Email', '');
        const url   = await ask('URL', '');
        meta.authors = [{ name, title, org, ...(email ? { email } : {}), ...(url ? { url } : {}) }];
      }
    }
  }

  // ── Editors (optional) ────────────────────────────────────────────────────
  meta.editors = [];
  if (!force) {
    const addEditor = await confirm('Add an editor? (optional, press N to skip)', false);
    if (addEditor) {
      const name  = await ask('Editor name');
      const title = await ask('Editor title', 'Technical Editor');
      const org   = await ask('Organization', '');
      meta.editors = [{ name, title, ...(org ? { org } : {}) }];
    }
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  if (opts.tags) {
    meta.tags = opts.tags.trim().split(/[\s,]+/).filter(Boolean);
  } else if (!force) {
    const tagStr = await ask('Tags (space or comma separated, or skip)', 'skip');
    meta.tags = tagStr === 'skip' ? [] : tagStr.split(/[\s,]+/).filter(Boolean);
  } else {
    meta.tags = [];
  }

  // ── Dates ──────────────────────────────────────────────────────────────────
  meta.createdDate     = TODAY;
  meta.lastUpdatedDate = TODAY;
  meta.publishDate     = meta.status === 'published' ? TODAY : '';

  // ── Version ────────────────────────────────────────────────────────────────
  meta.version = opts.version ?? '1.0.0';

  // ── Description (optional) ────────────────────────────────────────────────
  if (!force) {
    const desc = await ask('Short description / SEO summary (or skip)', 'skip');
    meta.description = desc === 'skip' ? '' : desc;
  }

  closeRL();
  return meta;
}

// ─── File utilities ───────────────────────────────────────────────────────────

export function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function titleCase(str) {
  return String(str)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Safe file write — will not overwrite unless force=true or user confirms.
 * @param {string} filePath
 * @param {string} content
 * @param {boolean} force
 * @returns {Promise<boolean>}  true if written
 */
export async function safeWrite(filePath, content, force = false) {
  if (existsSync(filePath) && !force) {
    const overwrite = await confirm(`File exists: ${pc.underline(basename(filePath))}. Overwrite?`, false);
    if (!overwrite) { log.skip(basename(filePath)); return false; }
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  log.ok(`Written: ${filePath}`);
  return true;
}

/**
 * Recursively find files matching extensions in a directory.
 * @param {string} dir
 * @param {string[]} exts  e.g. ['.md', '.mdx']
 * @returns {string[]}  absolute paths
 */
export function findFiles(dir, exts) {
  const results = [];
  if (!existsSync(dir)) return results;

  function walk(current) {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (exts.includes(extname(full).toLowerCase())) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Run pandoc to convert a file to commonmark (raw markdown).
 * @param {string} inputPath
 * @param {string} tmpDir
 * @returns {string}  converted content, or throws
 */
export function runPandoc(inputPath, tmpDir) {
  const ext  = extname(inputPath).toLowerCase();
  const fromMap = {
    '.odt':  'odt',
    '.docx': 'docx',
    '.doc':  'docx',
    '.rtf':  'rtf',
    '.html': 'html',
    '.htm':  'html',
    '.txt':  'plain',
    '.md':   'commonmark',
  };
  const from = fromMap[ext] ?? 'plain';
  const slug = slugify(basename(inputPath, ext));
  const tmp  = join(tmpDir, `${slug}-raw.md`);

  execFileSync('pandoc', ['-f', from, inputPath, '-t', 'commonmark', '-o', tmp], { stdio: 'pipe' });

  const content = readFileSync(tmp, 'utf8');
  try { require('fs').unlinkSync(tmp); } catch { /* fine */ }
  return content;
}
