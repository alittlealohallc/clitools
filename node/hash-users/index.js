#!/usr/bin/env node

const { Command } = require('commander');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');
const readline = require('readline');

const program = new Command();

program
  .name('hash-users')
  .version('1.1.2')
  .description('Generate bcrypt hashes for user credentials with bulk import and custom file export.')
  .option('-u, --name <name>', 'Single username (alias: username)')
  .option('-e, --email <email>', 'Single email')
  .option('-p, --password <pass>', 'Single password')
  .option('-t, --usertype <type>', 'User type: admin, staff, client, partner', /^(admin|staff|client|partner)$/i)
  .option('-r, --rounds <number>', 'Global salt rounds (default: 12)', parseInt)
  .option('-c, --csv <file>', 'Bulk import from CSV file')
  .option('-j, --json <file>', 'Bulk import from JSON file')
  .option('-o, --output <format>', 'Output format (ignored for bulk: always .md)', /^(md)$/i)
  .showHelpAfterError(true)
  .configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(str)
  });

// Enhanced Help Text with Examples
program.addHelpText('after', `
Examples:

  1. Single User (Interactive):
     $ hash-users -u alice -p "SecurePass123!" -t admin -r 14

  2. Bulk Import from CSV (Custom Filename):
     $ hash-users -c users.csv
     # Prompts: Enter output filename (or path): ./reports/alice_report.md

  3. Bulk Import from JSON:
     $ hash-users -j users.json
     # Prompts: Enter output filename (or path): audit_log.md

  4. Override Rounds Per User (CSV/JSON):
     # Include a 'rounds' column/key in your file to override the global -r flag.
     # e.g., CSV: name,password,rounds -> admin,pass123,14
`);

// Helper to normalize user object
const normalizeUser = (raw) => {
  const name = raw.name || raw.username || 'unknown';
  const email = raw.email || '';
  const password = raw.password;
  const usertype = (raw.usertype || 'client').toLowerCase();
  const rounds = raw.rounds !== undefined ? parseInt(raw.rounds) : (raw.password_rounds !== undefined ? parseInt(raw.password_rounds) : null);
  
  return { name, email, password, usertype, rounds };
};

// Helper to prompt user
const promptUser = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

// Helper to ensure directory exists
const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

program.action(async (options) => {
  const rawArgs = process.argv.slice(2);
  const users = [];
  const globalRounds = options.rounds || 12;

  // 1. Single User Mode
  if (options.name || options.email || options.password) {
    if (!options.password) {
      console.error('Error: Password (-p) is required for single-user mode.');
      program.outputHelp();
      process.exit(1);
    }
    users.push(normalizeUser({
      name: options.name,
      email: options.email,
      password: options.password,
      usertype: options.usertype,
      rounds: null
    }));
  }

  // 2. CSV Import
  if (options.csv) {
    try {
      if (!fs.existsSync(options.csv)) throw new Error(`File not found: ${options.csv}`);
      const csvContent = fs.readFileSync(options.csv, 'utf8');
      const records = parse(csvContent, { 
        columns: true, 
        skip_empty_lines: true, 
        trim: true 
      });

      if (!Array.isArray(records) || records.length === 0) throw new Error('CSV is empty.');

      const firstRow = records[0];
      const availableKeys = Object.keys(firstRow).map(k => k.toLowerCase());
      
      const hasName = availableKeys.includes('name') || availableKeys.includes('username');
      const hasPass = availableKeys.includes('password');

      if (!hasName || !hasPass) {
        throw new Error(`Missing required columns. Found: ${availableKeys.join(', ')}. Required: name (or username), password.`);
      }

      records.forEach((r, idx) => {
        if (!r.password) throw new Error(`Row ${idx + 2} missing password.`);
        users.push(normalizeUser(r));
      });
    } catch (err) {
      console.error(`CSV Error: ${err.message}`);
      process.exit(1);
    }
  }

  // 3. JSON Import
  if (options.json) {
    try {
      if (!fs.existsSync(options.json)) throw new Error(`File not found: ${options.json}`);
      const data = JSON.parse(fs.readFileSync(options.json, 'utf8'));
      if (!Array.isArray(data)) throw new Error('JSON must be an array.');
      if (data.length === 0) throw new Error('JSON array is empty.');

      data.forEach((u, idx) => {
        if (!u.name && !u.username) throw new Error(`Item ${idx} missing 'name' or 'username'.`);
        if (!u.password) throw new Error(`Item ${idx} missing 'password'.`);
        users.push(normalizeUser(u));
      });
    } catch (err) {
      if (err instanceof SyntaxError) console.error(`JSON Syntax Error: Invalid JSON.`);
      else console.error(`JSON Error: ${err.message}`);
      process.exit(1);
    }
  }

  if (users.length === 0) {
    console.error('Error: No users provided.');
    program.outputHelp();
    process.exit(1);
  }

  // 4. Process Hashes
  const results = [];
  for (const user of users) {
    try {
      const rounds = user.rounds || globalRounds;
      const hash = await bcrypt.hash(user.password, rounds);
      results.push({ ...user, hash, rounds });
    } catch (err) {
      results.push({ ...user, error: err.message });
    }
  }

  // 5. Generate Markdown Content
  let mdContent = `# User Hash Report\nGenerated: ${new Date().toLocaleString()}\n\n`;
  mdContent += `| Name | Email | Type | Rounds | Hash |\n`;
  mdContent += `|------|-------|------|--------|------|\n`;
  
  results.forEach(r => {
    mdContent += `| ${r.name} | ${r.email} | ${r.usertype} | ${r.rounds} | ${r.hash || 'ERROR'} |\n`;
  });

  // 6. Export Logic with Custom Filename
  const isBulk = options.csv || options.json;
  const showConsole = !isBulk || results.length <= 10;

  if (isBulk) {
    let filepath = null;
    let overwriteConfirmed = false;

    while (!overwriteConfirmed) {
      const input = await promptUser('Enter output filename (or path): ');
      if (!input) {
        console.log('[INFO] No filename provided. Exiting.');
        process.exit(0);
      }

      filepath = path.resolve(input);

      if (fs.existsSync(filepath)) {
        const answer = await promptUser(`File '${filepath}' already exists. Overwrite? (y/n): `);
        if (answer.toLowerCase() === 'y') {
          overwriteConfirmed = true;
        } else {
          console.log('[INFO] Cancelled. Please enter a new filename.');
        }
      } else {
        overwriteConfirmed = true;
      }
    }

    // Ensure directory exists
    ensureDir(filepath);

    // Write file
    fs.writeFileSync(filepath, mdContent);
    console.log(`[INFO] Bulk import detected. Report saved to: ${filepath}`);
    
    if (showConsole) {
      console.log(mdContent);
    } else {
      console.log(`[INFO] Suppressed console output (${results.length} lines > 10). View file: ${filepath}`);
    }
  } else {
    // Single user: Default to console only
    console.log(mdContent);
  }
});

program.parse();