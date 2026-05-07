#!/usr/bin/env node

const { Command } = require('commander');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const program = new Command();

program
  .name('hash-users')
  .description('Generate bcrypt hashes for user credentials with optional bulk import')
  .option('-u, --username <name>', 'Single username')
  .option('-e, --email <email>', 'Single email')
  .option('-p, --password <pass>', 'Single password')
  .option('-t, --usertype <type>', 'User type: admin, staff, client, partner', /^(admin|staff|client|partner)$/i)
  .option('-r, --rounds <number>', 'Salt rounds (default: 12)', parseInt)
  .option('-c, --csv <file>', 'Bulk import from CSV file')
  .option('-j, --json <file>', 'Bulk import from JSON file')
  .option('-o, --output <format>', 'Output format: md, txt, odf', /^(md|txt|odf)$/i, 'md')
  .showHelpAfterError(true)
  .configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(str)
  });

// Custom action handler
program.action(async (options) => {
  // 1. Check if NO options were provided (except help/version)
  // Commander sets options to {} if no flags are passed, but we need to check raw args
  const rawArgs = process.argv.slice(2);
  
  // If no arguments at all, or only help flags, show help and exit
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    program.outputHelp();
    process.exit(0);
  }

  const users = [];
  const rounds = options.rounds || 12;

  // 2. Single User Mode
  if (options.username || options.email || options.password) {
    if (!options.password) {
      console.error('Error: Password (-p) is required for single-user mode.');
      program.outputHelp();
      process.exit(1);
    }
    users.push({
      username: options.username || 'unknown',
      email: options.email || '',
      password: options.password,
      usertype: (options.usertype || 'client').toLowerCase()
    });
  }

  // 3. CSV Import
  if (options.csv) {
    try {
      if (!fs.existsSync(options.csv)) throw new Error(`File not found: ${options.csv}`);
      const csvContent = fs.readFileSync(options.csv, 'utf8');
      const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
      
      if (!Array.isArray(records)) throw new Error('Invalid CSV format');
      
      records.forEach(r => {
        users.push({
          username: r.username || 'unknown',
          email: r.email || '',
          password: r.password,
          usertype: (r.usertype || 'client').toLowerCase()
        });
      });
    } catch (err) {
      console.error(`CSV Error: ${err.message}`);
      process.exit(1);
    }
  }

  // 4. JSON Import
  if (options.json) {
    try {
      if (!fs.existsSync(options.json)) throw new Error(`File not found: ${options.json}`);
      const data = JSON.parse(fs.readFileSync(options.json, 'utf8'));
      if (!Array.isArray(data)) throw new Error('JSON must be an array');
      
      data.forEach(u => {
        users.push({
          username: u.username || 'unknown',
          email: u.email || '',
          password: u.password,
          usertype: (u.usertype || 'client').toLowerCase()
        });
      });
    } catch (err) {
      console.error(`JSON Error: ${err.message}`);
      process.exit(1);
    }
  }

  // 5. Validation
  if (users.length === 0) {
    console.error('Error: No users found. Please provide options (-u, -c, or -j).');
    program.outputHelp();
    process.exit(1);
  }

  // 6. Execution
  try {
    const results = [];
    for (const user of users) {
      if (!user.password) {
        results.push({ ...user, error: 'Missing password' });
        continue;
      }
      const hash = await bcrypt.hash(user.password, rounds);
      results.push({ ...user, hash });
    }

    // 7. Output
    let output = '';
    if (options.output === 'md') {
      output = '# User Hash Report\n\n| Username | Email | UserType | Hash |\n|----------|-------|----------|------|\n';
      results.forEach(r => {
        output += `| ${r.username} | ${r.email} | ${r.usertype} | ${r.hash || 'ERROR'} |\n`;
      });
    } else if (options.output === 'txt') {
      output = 'User Hash Report\n================\n\n';
      results.forEach(r => {
        output += `Username: ${r.username}\nEmail: ${r.email}\nType: ${r.usertype}\nHash: ${r.hash || 'ERROR'}\n\n`;
      });
    } else if (options.output === 'odf') {
      output = '<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0">\n  <office:body>\n    <office:text>\n';
      results.forEach(r => {
        output += `      <text:p>Username: ${r.username}, Email: ${r.email}, Type: ${r.usertype}, Hash: ${r.hash || 'ERROR'}</text:p>\n`;
      });
      output += '    </office:text>\n  </office:body>\n</office:document-content>';
    }
    
    console.log(output);
  } catch (err) {
    console.error(`Processing Error: ${err.message}`);
    process.exit(1);
  }
});

program.parse();