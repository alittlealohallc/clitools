#!/usr/bin/env node
'use strict';

// Usage: node .husky/bump-version.cjs <patch|minor|major> [path/to/package.json]
const fs = require('fs');
const path = require('path');

const bump_type = process.argv[2];
const pkg_path = path.resolve(process.argv[3] || './package.json');

if (!['patch', 'minor', 'major'].includes(bump_type)) {
    process.stderr.write(`bump-version: invalid type "${bump_type}". Use patch, minor, or major.\n`);
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkg_path, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);

if (bump_type === 'major')      pkg.version = `${major + 1}.0.0`;
else if (bump_type === 'minor') pkg.version = `${major}.${minor + 1}.0`;
else                            pkg.version = `${major}.${minor}.${patch + 1}`;

fs.writeFileSync(pkg_path, JSON.stringify(pkg, null, 2) + '\n');
process.stdout.write('v' + pkg.version + '\n');
