#!/usr/bin/env node

import { 
  existsSync, mkdirSync, readFileSync, writeFileSync 
} from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { glob } from 'glob';
import { program } from 'commander';

// --- ES Module Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = '1.0.0';
const SCRIPT_NAME = 'md2pdf';

// --- Helpers ---
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkDependencies() {
  const missing = [];
  if (!commandExists('pandoc')) missing.push('pandoc');
  if (!commandExists('pdflatex')) missing.push('pdflatex (from basictex)');
  
  if (missing.length > 0) {
    console.error('\n[ERROR] Missing dependencies:');
    missing.forEach(dep => console.error(`   - ${dep}`));
    console.error('\nRun: ./setup.sh');
    process.exit(1);
  }
}

async function collectFiles(inputs) {
  const files = [];
  for (const raw of inputs) {
    const input = resolve(raw);
    if (!existsSync(input)) {
      console.warn(`[WARN] Not found: ${input}`);
      continue;
    }
    
    // Glob for all markdown files in directory
    const matches = await glob('**/*.{md,mdx,html}', {
      cwd: input,
      absolute: true,
      nodir: true
    });
    
    if (matches.length > 0) {
      files.push(...matches);
    } else {
      files.push(input);
    }
  }
  return [...new Set(files)].sort();
}

async function convertFile(inputFile, outputDir) {
  const baseName = basename(inputFile, extname(inputFile));
  const outputFile = join(outputDir, `${baseName}.pdf`);
  
  if (existsSync(outputFile)) {
    console.warn(`[WARN] Output exists (overwriting): ${basename(outputFile)}`);
  }
  
  try {
    // Determine input format
    const ext = extname(inputFile).toLowerCase();
    const fromFormat = ext === '.html' || ext === '.htm' ? 'html' : 'markdown';
    
    // Build pandoc command WITHOUT template, using variables
    const cmd = [
      'pandoc',
      `"${inputFile}"`,
      `-f ${fromFormat}`,
      '-t pdf',
      `--pdf-engine=lualatex`,
      `-V margin-left=0.7in`,
      `-V margin-right=0.7in`,
      `-V margin-top=0.7in`,
      `-V margin-bottom=0.7in`,
      `-V fontsize=11pt`,
      `-V papersize=letter`,
      `-V mainfont="Times New Roman"`,
      `-V monofont="Courier New"`,
      `-o "${outputFile}"`
    ].join(' ');
    
    console.log(`[INFO] Converting: ${basename(inputFile)}...`);
    execSync(cmd, { stdio: 'pipe' });
    console.log(`[OK] Created: ${basename(outputFile)}`);
    return true;
    
  } catch (err) {
    console.error(`[ERROR] Conversion failed [${basename(inputFile)}]:`);
    console.error(`   ${err.message}`);
    return false;
  }
}


// --- Main ---
checkDependencies();

program
  .name(SCRIPT_NAME)
  .description('Convert Markdown/HTML to clean PDF (Letter, 0.7" margins, Charter font)')
  .version(VERSION);

program
  .command('convert')
  .description('Convert markdown/html files to PDF')
  .requiredOption('-i, --input <paths...>', 'Input files or directories')
  .option('-o, --output <dir>', 'Output directory', './')
  .action(async (opts) => {
    const files = await collectFiles(opts.input);
    
    if (files.length === 0) {
      console.error('[ERROR] No markdown/html files found.');
      process.exit(1);
    }
    
    // Validate output directory
    const outDir = resolve(opts.output);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    
    let success = 0, failed = 0;
    for (const file of files) {
      const result = await convertFile(file, outDir);
      result ? success++ : failed++;
    }
    
    console.log(`\n[STATS] Results: ${success} succeeded, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });

program.parse();
