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
  .version('1.1.4')
  .description('Generate bcrypt hashes. Flexible import: adapts to CSV headers/JSON keys.')
  .option('-u, --name <name>', 'Single username')
  .option('-e, --email <email>', 'Single email')
  .option('-p, --password <pass>', 'Single password')
  .option('-t, --usertype <type>', 'User type: admin, staff, client, partner', /^(admin|staff|client|partner)$/i)
  .option('-r, --rounds <number>', 'Global salt rounds (default: 12)', parseInt)
  .option('-c, --csv <file>', 'Bulk import from CSV file')
  .option('-j, --json <file>', 'Bulk import from JSON file')
  .showHelpAfterError(true)
  .configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(str)
  });

// Help Text with Flexible Format Examples
program.addHelpText('after', `
Flexible Import Format:
-----------------------
The script adapts to your file's headers (CSV) or keys (JSON).
Required: A column/key for 'name' (or 'username') and 'password'.
Optional: 'email', 'usertype', 'rounds'.

Examples:

  1. Single User:
     $ hash-users -u alice -p "SecurePass123!" -t admin -r 14

  2. Bulk CSV (Any Header Names):
     $ hash-users -c users.csv
     # Works with:
     # user_id,user_email,secret_pass,role,salt_rounds
     # alice,alice@test.com,pass123,admin,14
     # OR
     # name,email,password,usertype,rounds
     # bob,bob@test.com,pass456,staff,12

  3. Bulk JSON (Any Key Names):
     $ hash-users -j users.json
     # Works with:
     # [{"user_id": "alice", "secret_pass": "pass123", "role": "admin", "salt_rounds": 14}]

  4. Custom Output Path:
     $ hash-users -c users.csv
     # Prompts: Enter output filename (or path): ./reports/audit_2026.md
`);

// Helper to normalize user object based on dynamic keys
const normalizeUser = (raw) => {
  // Dynamic lookup for name (checks 'name', 'username', 'user_id', 'id', etc.)
  const possibleNames = ['name', 'username', 'user_id', 'id', 'login'];
  let name = 'unknown';
  for (const key of possibleNames) {
    if (raw[key] !== undefined) {
      name = raw[key];
      break;
    }
  }

  // Dynamic lookup for email
  const possibleEmails = ['email', 'mail', 'user_email', 'e-mail'];
  let email = '';
  for (const key of possibleEmails) {
    if (raw[key] !== undefined) {
      email = raw[key];
      break;
    }
  }

  // Dynamic lookup for password (strictly 'password' or 'pass' or 'pwd')
  const possiblePass = ['password', 'pass', 'pwd', 'secret_pass', 'password_hash'];
  let password = null;
  for (const key of possiblePass) {
    if (raw[key] !== undefined) {
      password = raw[key];
      break;
    }
  }

  // Dynamic lookup for usertype
  const possibleTypes = ['usertype', 'user_type', 'role', 'type', 'group'];
  let usertype = 'client';
  for (const key of possibleTypes) {
    if (raw[key] !== undefined) {
      usertype = String(raw[key]).toLowerCase();
      break;
    }
  }

  // Dynamic lookup for rounds
  const possibleRounds = ['rounds', 'salt_rounds', 'cost', 'bcrypt_rounds'];
  let rounds = null;
  for (const key of possibleRounds) {
    if (raw[key] !== undefined) {
      rounds = parseInt(raw[key]);
      break;
    }
  }

  if (!password) {
    throw new Error('Missing password field in row/object.');
  }

  return { name, email, password, usertype, rounds };
};

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

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

program.action(async (options) => {
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

  // 2. CSV Import (Flexible Headers)
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

      // Validate that at least one row has a password
      let hasValidData = false;
      records.forEach((r, idx) => {
        try {
          const normalized = normalizeUser(r);
          if (normalized.password) {
            users.push(normalized);
            hasValidData = true;
          }
        } catch (err) {
          // If a row is missing password, we could skip or fail. 
          // Let's fail fast for data integrity, but give a clear error.
          throw new Error(`Row ${idx + 2} is missing a password field.`);
        }
      });

      if (!hasValidData) throw new Error('No valid user data found. Ensure a column named "password" (or similar) exists.');

    } catch (err) {
      console.error(`CSV Error: ${err.message}`);
      console.error('Tip: Ensure your CSV has a header row with at least "name" (or "username") and "password".');
      process.exit(1);
    }
  }

  // 3. JSON Import (Flexible Keys)
  if (options.json) {
    try {
      if (!fs.existsSync(options.json)) throw new Error(`File not found: ${options.json}`);
      const data = JSON.parse(fs.readFileSync(options.json, 'utf8'));
      if (!Array.isArray(data)) throw new Error('JSON must be an array.');
      if (data.length === 0) throw new Error('JSON array is empty.');

      data.forEach((u, idx) => {
        try {
          const normalized = normalizeUser(u);
          users.push(normalized);
        } catch (err) {
          throw new Error(`Item ${idx} is missing a password field.`);
        }
      });

    } catch (err) {
      if (err instanceof SyntaxError) console.error(`JSON Syntax Error: Invalid JSON.`);
      else console.error(`JSON Error: ${err.message}`);
      console.error('Tip: Ensure your JSON array contains objects with at least "name" (or "username") and "password".');
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

  // 6. Export Logic
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

    ensureDir(filepath);
    fs.writeFileSync(filepath, mdContent);
    console.log(`[INFO] Bulk import detected. Report saved to: ${filepath}`);
    
    if (showConsole) {
      console.log(mdContent);
    } else {
      console.log(`[INFO] Suppressed console output (${results.length} lines > 10). View file: ${filepath}`);
    }
  } else {
    console.log(mdContent);
  }
});

program.parse();