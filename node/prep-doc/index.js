#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync, copyFileSync, renameSync, rmSync } from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { glob } from 'glob';
import { program } from 'commander';

// --- ES Module Compatibility ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Configuration & Constants ---
const SCRIPT_NAME = 'prep-doc';
const HOME_DIR = homedir();
const BIN_DIR = join(HOME_DIR, 'bin');
const SHELL_RC = join(HOME_DIR, '.zshrc');
const TARGET_SCRIPT_PATH = __filename;

// Repository Paths (Hardcoded as requested - Edit these if structure changes)
const REPO_BASE = join(HOME_DIR, 'git', 'www-alittlealoha-pro');
const REPOS = {
  admin: join(REPO_BASE, 'packages', 'admin', 'src', 'content', 'docs'),
  public: join(REPO_BASE, 'packages', 'public', 'src', 'content', 'docs')
};

// Supported Formats
const PANDOC_OUT_MAP = {
  md: 'commonmark',
  mdx: 'commonmark',
  txt: 'plain',
  html: 'html5',
  pdf: 'pdf',
  rst: 'rst',
  docx: 'docx',
  epub: 'epub'
};

const LO_OUT_FORMATS = new Set(['pdf', 'html', 'docx', 'odt', 'txt', 'epub']);

const INPUT_EXT_MAP = {
  odf: ['.odt', '.ods', '.odp', '.odg', '.odf'],
  txt: ['.txt'],
  md: ['.md', '.mdx'],
  docx: ['.docx'],
  rtf: ['.rtf'],
  html: ['.html', '.htm'],
  rst: ['.rst']
};

const DEFAULT_SCAN_EXTS = ['.odt', '.odf', '.txt'];

// --- Frontmatter Templates ---

const PUBLIC_TEMPLATE_FIELDS = `---
title: ""
description: ""
authors:
  - name: ""
    title: ""
    org: ""
    url: ""
    email: ""
    orcid: ""
editors:
  - name: ""
    title: ""
    org: ""
    url: ""
tags: []
createdDate: ""
publishDate: ""
lastUpdatedDate: ""
nextReviewDate: ""
draft: true
abstract: ""
keywords: []
doi: ""
citation: ""
license: ""
funding: ""
---

`;

const ADMIN_TEMPLATE_FIELDS = `---
title: ""
description: ""
authors:
  - name: "Kent Schaeffer"
    title: "Author"
    org: "Pro Services With A Little Aloha"
    url: "https://alittlealoha.pro"
    email: "kent@alittlealoha.pro"
tags: []
createdDate: ""
publishDate: ""
lastUpdatedDate: ""
nextReviewDate: ""
draft: true
---

`;

// --- Helpers ---

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
  const ext = extname(filePath).toLowerCase();
  for (const [fmt, exts] of Object.entries(INPUT_EXT_MAP)) {
    if (exts.includes(ext)) return fmt;
  }
  return null;
}

function hasFrontmatter(content) {
  return /^---\r?\n/.test(content.trimStart());
}

// --- Dependency Check ---

function checkDependencies() {
  const hasPandoc = commandExists('pandoc');
  const hasLO = commandExists('soffice');

  if (!hasPandoc && !hasLO) {
    console.error(`[ERROR] Critical Error: Neither pandoc nor LibreOffice (soffice) found in PATH.`);
    console.error(`   Please install one of the following to proceed:`);
    console.error(`   - Pandoc: brew install pandoc (macOS) or apt-get install pandoc`);
    console.error(`   - LibreOffice: brew install --cask libreoffice (macOS) or apt-get install libreoffice`);
    process.exit(1);
  }
  
  if (!hasPandoc) console.log('[INFO] Using LibreOffice as primary converter (Pandoc missing).');
  if (!hasLO) console.log('[INFO] Using Pandoc as primary converter (LibreOffice missing).');
}

// --- File Collection ---

async function collectFiles(inputs, inputFormat) {
  const scanExts = inputFormat ? (INPUT_EXT_MAP[inputFormat.toLowerCase()] ?? []) : DEFAULT_SCAN_EXTS;
  const files = [];

  for (const raw of inputs) {
    const input = resolve(raw);
    if (!existsSync(input)) {
      console.error(`[ERROR] Not found: ${input}`);
      continue;
    }

    const s = statSync(input);

    if (s.isDirectory()) {
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

// --- Core Logic Functions ---

/**
 * Converts a single file using pandoc or libreoffice
 */
async function convertFile(inputFile, opts) {
  const { outputFormat, outputDir, injectMdx, force } = opts;
  const baseName = basename(inputFile, extname(inputFile));
  const slug = slugify(baseName);
  const outExt = outputFormat === 'mdx' ? '.mdx' : `.${outputFormat}`;
  const outputFile = join(outputDir, `${slug}${outExt}`);

  // Check existence
  if (existsSync(outputFile) && !force) {
    const ans = await ask(`[WARN] '${basename(outputFile)}' exists. Overwrite? (y/n): `);
    if (!/^y/i.test(ans)) {
      console.log('   Skipped.');
      return false;
    }
  }

  // Convert
  const hasPandoc = commandExists('pandoc');
  const hasLO = commandExists('soffice');
  let converted = false;

  try {
    if (hasPandoc && PANDOC_OUT_MAP[outputFormat]) {
      const fromMap = {
        '.odt': 'odt', '.odf': 'odt', '.docx': 'docx', '.rtf': 'rtf',
        '.html': 'html', '.htm': 'html', '.rst': 'rst', '.md': 'commonmark', '.mdx': 'commonmark', '.txt': 'plain'
      };
      const ext = extname(inputFile).toLowerCase();
      const fromFlag = fromMap[ext] ? `-f ${fromMap[ext]}` : '';
      const pdfEngine = outputFormat === 'pdf' ? '--pdf-engine=xelatex' : '';
      
      const cmd = `pandoc ${fromFlag} "${inputFile}" -t ${PANDOC_OUT_MAP[outputFormat]} ${pdfEngine} -o "${outputFile}"`;
      execSync(cmd, { stdio: 'pipe' });
      converted = true;
    } else if (hasLO && LO_OUT_FORMATS.has(outputFormat)) {
      execSync(`soffice --headless --convert-to ${outputFormat} --outdir "${outputDir}" "${inputFile}"`, { stdio: 'pipe' });
      // LO renames to original basename, so we rename to slug
      const loFile = join(outputDir, `${baseName}.${outputFormat}`);
      if (existsSync(loFile)) {
        renameSync(loFile, outputFile);
      }
      converted = true;
    } else {
      throw new Error('No suitable converter available for this format.');
    }

    if (!existsSync(outputFile)) throw new Error('Output file was not created.');

    // Frontmatter Injection
    if (['md', 'mdx'].includes(outputFormat) && injectMdx) {
      let content = readFileSync(outputFile, 'utf8');
      if (!hasFrontmatter(content)) {
        const title = titleCase(baseName);
        const fm = `---\ntitle: "${title}"\ndescription: "Converted from ${basename(inputFile)}"\ndraft: true\n---\n\n`;
        writeFileSync(outputFile, fm + content, 'utf8');
        console.log(`[SUCCESS] Frontmatter injected`);
      }
    }

    console.log(`[SUCCESS] Converted: ${basename(inputFile)} -> ${basename(outputFile)}`);
    return true;
  } catch (err) {
    console.error(`[ERROR] Conversion failed [${basename(inputFile)}]: ${err.message}`);
    return false;
  }
}

/**
 * Creates a new .mdx file with frontmatter
 */
async function createFile(opts) {
  const { repo, category, subcat, tags, force } = opts;
  
  if (!REPOS[repo]) {
    console.error(`[ERROR] Invalid repository: ${repo}. Must be 'admin' or 'public'.`);
    return false;
  }

  const catSlug = slugify(category);
  const subSlug = subcat ? slugify(subcat) : '';
  const targetDir = join(REPOS[repo], catSlug, subSlug);

  // Directory Creation
  if (!existsSync(targetDir)) {
    if (!force) {
      const ans = await ask(`[WARN] Directory '${targetDir}' does not exist. Create? (y/n): `);
      if (!/^y/i.test(ans)) {
        console.log('   Skipped.');
        return false;
      }
    }
    mkdirSync(targetDir, { recursive: true });
    console.log(`[SUCCESS] Created directory: ${targetDir}`);
  }

  const fileName = `${catSlug}-${subSlug || 'index'}.mdx`; // Default naming strategy
  const filePath = join(targetDir, fileName);

  if (existsSync(filePath) && !force) {
    const ans = await ask(`[WARN] '${fileName}' exists. Overwrite? (y/n): `);
    if (!/^y/i.test(ans)) {
      console.log('   Skipped.');
      return false;
    }
  }

  const template = repo === 'public' ? PUBLIC_TEMPLATE_FIELDS : ADMIN_TEMPLATE_FIELDS;
  writeFileSync(filePath, template, 'utf8');

  console.log(`[SUCCESS] Created file: ${filePath}`);
  return true;
}

/**
 * Moves a file to the repo structure, optionally converting and injecting frontmatter
 */
async function moveFile(inputFile, opts) {
  const { outputDir, repo, category, subcat, tags, injectMdx, force } = opts;
  
  if (!REPOS[repo]) {
    console.error(`[ERROR] Invalid repository: ${repo}. Must be 'admin' or 'public'.`);
    return false;
  }

  const catSlug = slugify(category);
  const subSlug = subcat ? slugify(subcat) : '';
  const targetDir = join(REPOS[repo], catSlug, subSlug);

  // Directory Creation
  if (!existsSync(targetDir)) {
    if (!force) {
      const ans = await ask(`[WARN] Directory '${targetDir}' does not exist. Create? (y/n): `);
      if (!/^y/i.test(ans)) {
        console.log('   Skipped.');
        return false;
      }
    }
    mkdirSync(targetDir, { recursive: true });
    console.log(`[SUCCESS] Created directory: ${targetDir}`);
  }

  const baseName = basename(inputFile, extname(inputFile));
  const slug = slugify(baseName);
  const outExt = extname(inputFile); // Keep original extension unless converting
  
  const outputFile = join(targetDir, `${slug}${outExt}`);

  if (existsSync(outputFile) && !force) {
    const ans = await ask(`[WARN] '${basename(outputFile)}' exists. Overwrite? (y/n): `);
    if (!/^y/i.test(ans)) {
      console.log('   Skipped.');
      return false;
    }
  }

  // Copy (Move)
  try {
    copyFileSync(inputFile, outputFile);
    console.log(`[SUCCESS] Moved: ${basename(inputFile)} -> ${basename(outputFile)}`);
  } catch (err) {
    console.error(`[ERROR] Move failed: ${err.message}`);
    return false;
  }

  // Frontmatter Injection (if .md or .mdx)
  if (['.md', '.mdx'].includes(outExt) && injectMdx) {
    let content = readFileSync(outputFile, 'utf8');
    if (!hasFrontmatter(content)) {
      const title = titleCase(baseName);
      const template = repo === 'public' ? PUBLIC_TEMPLATE_FIELDS : ADMIN_TEMPLATE_FIELDS;
      // Inject template at top
      writeFileSync(outputFile, template + content, 'utf8');
      console.log(`[SUCCESS] Frontmatter injected`);
    }
  }

  return true;
}

// --- Setup Wrapper ---

function setupWrapper() {
  console.log('--- Starting Setup for prep-doc ---');

  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
    console.log(`Created directory: ${BIN_DIR}`);
  }

  const wrapperPath = join(BIN_DIR, SCRIPT_NAME);
  const wrapperContent = `#!/bin/bash
exec node "${TARGET_SCRIPT_PATH}" "$@"
`;

  try {
    writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });
    chmodSync(wrapperPath, 0o755);
    console.log(`Created wrapper script: ${wrapperPath}`);
  } catch (err) {
    console.error(`[ERROR] Failed to create wrapper. ${err.message}`);
    process.exit(1);
  }

  let rcContent = '';
  const pathExportLine = `export PATH="$HOME/bin:$PATH"`;
  let needsUpdate = true;

  if (existsSync(SHELL_RC)) {
    rcContent = readFileSync(SHELL_RC, 'utf8');
    if (rcContent.includes(pathExportLine) || rcContent.includes('$HOME/bin')) {
      console.log('PATH entry for ~/bin already exists in ~/.zshrc.');
      needsUpdate = false;
    }
  }

  if (needsUpdate) {
    const separator = rcContent.length > 0 && !rcContent.endsWith('\n') ? '\n' : '';
    writeFileSync(SHELL_RC, rcContent + separator + pathExportLine + '\n');
    console.log(`Updated ${SHELL_RC} with PATH export.`);
  }

  console.log('\n--- Setup Complete ---');
  console.log(`Run "prep-doc [options]" from anywhere.`);
  console.log('IMPORTANT: Run "source ~/.zshrc" or restart your terminal.');
}

// --- Usage Help ---

function showUsage() {
  const usage = `
prep-doc - A CLI utility for document lifecycle management

USAGE:
  prep-doc <command> [options]

COMMANDS:
  convert    Convert documents between formats (pandoc/libreoffice)
  create     Create new .mdx files with frontmatter scaffolding
  move       Move files to repo structure with optional frontmatter injection

OPTIONS:
  --setup    Install shell wrapper and configure PATH
  --help, -h Show this help message
  --version  Show version information
  --force, -y Skip all interactive prompts (create dirs, overwrite)

EXAMPLES:

  Convert a DOCX to MDX:
    prep-doc convert -i report.docx -f mdx -o ./output/

  Create a new admin guide:
    prep-doc create -r admin -c guides -s security -t "firewall dns"

  Move a file to public repo:
    prep-doc move -i draft.txt -r public -c news -s "updates" -t "release"

ACCEPTABLE FORMATS:
  Input: ODF, DOCX, RTF, HTML, TXT, MD, MDX, RST
  Output: MD, MDX, TXT, PDF, HTML, DOCX, ODT, RST, EPUB

REPOSITORIES:
  admin  -> ~/git/www-alittlealoha-pro/packages/admin/src/content/docs
  public -> ~/git/www-alittlealoha-pro/packages/public/src/content/docs
`;
  console.log(usage);
}

// --- Main Execution ---

if (process.argv.includes('--setup')) {
  setupWrapper();
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

if (process.argv.includes('--version')) {
  console.log('prep-doc v1.0.0');
  process.exit(0);
}

checkDependencies();

const command = process.argv[2];
const validCommands = ['convert', 'create', 'move'];

if (!command || !validCommands.includes(command)) {
  console.error('[ERROR] Invalid or missing command.');
  showUsage();
  process.exit(1);
}

program
  .name(SCRIPT_NAME)
  .description('Document lifecycle management for www-alittlealoha-pro')
  .version('1.0.0');

// Convert Command
program
  .command('convert')
  .description('Convert documents between formats')
  .requiredOption('-i, --input <paths...>', 'Input files or folders')
  .option('-o, --output <dir>', 'Output directory', './')
  .option('-f, --format <fmt>', 'Output format', 'mdx')
  .option('--no-mdx', 'Skip frontmatter injection')
  .option('--force, -y', 'Skip prompts')
  .action(async (opts) => {
    const files = await collectFiles(opts.input, null);
    if (files.length === 0) {
      console.error('[ERROR] No matching files found.');
      process.exit(1);
    }
    
    const outDir = resolve(opts.output);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    let ok = 0, fail = 0;
    for (const file of files) {
      const success = await convertFile(file, {
        outputFormat: opts.format,
        outputDir: outDir,
        injectMdx: opts.mdx !== false,
        force: opts.force
      });
      success ? ok++ : fail++;
    }
    console.log(`\n[STATS] Done — ${ok} succeeded, ${fail} failed`);
    if (fail > 0) process.exit(1);
  });

// Create Command
program
  .command('create')
  .description('Create new .mdx files with frontmatter')
  .requiredOption('-r, --repo <name>', 'Repository (admin or public)')
  .requiredOption('-c, --category <name>', 'Category')
  .option('-s, --subcat <name>', 'Sub-category')
  .option('-t, --tags <tags>', 'Tags (space separated, quoted)')
  .option('--force, -y', 'Skip prompts')
  .action(async (opts) => {
    const tags = opts.tags ? opts.tags.split(/\s+/) : [];
    await createFile({ ...opts, tags });
  });

// Move Command
program
  .command('move')
  .description('Move files to repo structure')
  .requiredOption('-i, --input <paths...>', 'Input files or folders')
  .requiredOption('-r, --repo <name>', 'Repository (admin or public)')
  .requiredOption('-c, --category <name>', 'Category')
  .option('-s, --sub <name>', 'Sub-category')
  .option('-t, --tags <tags>', 'Tags (space separated, quoted)')
  .option('--no-mdx', 'Skip frontmatter injection')
  .option('--force, -y', 'Skip prompts')
  .action(async (opts) => {
    const files = await collectFiles(opts.input, null);
    if (files.length === 0) {
      console.error('[ERROR] No matching files found.');
      process.exit(1);
    }

    let ok = 0, fail = 0;
    for (const file of files) {
      const success = await moveFile(file, {
        repo: opts.repo,
        category: opts.category,
        subcat: opts.sub,
        tags: opts.tags ? opts.tags.split(/\s+/) : [],
        injectMdx: opts.mdx !== false,
        force: opts.force
      });
      success ? ok++ : fail++;
    }
    console.log(`\n[STATS] Done — ${ok} moved, ${fail} failed`);
    if (fail > 0) process.exit(1);
  });

program.parse();