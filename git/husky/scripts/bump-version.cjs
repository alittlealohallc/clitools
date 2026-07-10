#!/usr/bin/env node
'use strict';

// Usage: node scripts/bump-version.cjs <patch|minor|major> [path/to/package.json]
const fs = require('fs');
const path = require('path');

const type = process.argv[2];
const pkgPath = path.resolve(process.argv[3] || './package.json');

if (!['patch', 'minor', 'major'].includes(type)) {
    process.stderr.write(`bump-version: invalid type "${type}". Use patch, minor, or major.\n`);
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);

if (type === 'major')      pkg.version = `${maj + 1}.0.0`;
else if (type === 'minor') pkg.version = `${maj}.${min + 1}.0`;
else                       pkg.version = `${maj}.${min}.${pat + 1}`;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
process.stdout.write('v' + pkg.version + '\n');
