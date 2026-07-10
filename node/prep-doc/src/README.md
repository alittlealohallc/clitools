# prep-doc

CLI tools for document preparation at A Little Aloha LLC. Converts, scaffolds,
normalizes, and batch-updates MDX documents for Astro/Starlight projects.

**Location:** `~/git/clitools/prep-doc/`  
**Requires:** Node.js ≥ 20, [pandoc](https://pandoc.org/) (`brew install pandoc`)

---

## Installation

```zsh
cd ~/git/clitools/prep-doc
npm install
npm link
```

`npm link` installs four commands into your PATH:

| Command | Purpose |
| :--- | :--- |
| `doc-convert` | Convert `.odt`, `.docx`, `.txt`, `.html`, `.rtf`, `.md` → `.mdx` |
| `doc-prep` | Normalize / stamp frontmatter on existing `.md` / `.mdx` files |
| `doc-create` | Scaffold a new `.mdx` from a template, or import an existing file |
| `doc-update` | Audit and batch-fix a docs library against the current standard |

Verify install:

```zsh
doc-create --help
```

---

## Content Directory Discovery

All tools auto-discover your Astro/Starlight `content/docs` directory by
checking (in order):

1. `./src/content/docs/`
2. `./packages/*/src/content/docs/` (monorepo)

If multiple directories are found you'll be prompted to choose. Use `--output`
to skip discovery and write directly to a path.

---

## Commands

### `doc-convert` — Convert documents to MDX

Convert source documents into MDX with injected frontmatter and a template body.

```zsh
# Basic usage
doc-convert report.odt

# Specify template and author
doc-convert report.odt --template research --author kent

# Batch convert a folder
doc-convert ./drafts/ --output ./src/content/docs/reports --force

# Skip all optional prompts
doc-convert notes.txt --author kent --type how-to --force
```

**Options:**

| Flag | Description |
| :--- | :--- |
| `-o, --output <dir>` | Output directory (auto-discovered if omitted) |
| `-t, --template <name>` | Template from `templates/` library |
| `--author <preset>` | Use `kent` to auto-fill author info |
| `--title <title>` | Document title (skips prompt) |
| `--type <type>` | Document type (`article`, `how-to`, `research`, …) |
| `--status <status>` | Workflow status — default `draft` |
| `--tags <tags>` | Tags, space or comma separated |
| `-f, --force` | Overwrite existing files without prompting |

---

### `doc-prep` — Normalize frontmatter

Fix, stamp, or normalize frontmatter on existing `.md` / `.mdx` files.
Never touches body content.

```zsh
# Stamp lastUpdatedDate on all docs (most common use)
doc-prep . --stamp

# Fill missing required fields interactively
doc-prep ./src/content/docs/guides/my-doc.mdx

# Bulk set status across a directory
doc-prep ./src/content/docs/legal --status published --force

# Append a tag to all files in a folder
doc-prep ./src/content/docs --add-tag utah

# Dry run — see what would change without writing
doc-prep . --dry-run
```

**Options:**

| Flag | Description |
| :--- | :--- |
| `--stamp` | Only update `lastUpdatedDate` to today |
| `--status <status>` | Set status on all matched files |
| `--add-tag <tag>` | Append a tag |
| `--remove-tag <tag>` | Remove a tag |
| `--version <ver>` | Set version field |
| `--dry-run` | Report changes without writing |
| `-f, --force` | Write without confirmation |

---

### `doc-create` — Create new documents

Scaffold a new `.mdx` from the template library, or import/move an existing file.

```zsh
# Fully interactive
doc-create

# Specify template (skips template picker)
doc-create --template research

# Specify everything (minimal prompts)
doc-create --template ddi-design --category ddi --subcat bind \
  --author kent --type design --force

# Import an existing file into the docs structure
doc-create --move ./drafts/notes.md --template tech-internal --category ops

# Import and keep the original
doc-create --move ./old-doc.md --template runbook --copy
```

**Options:**

| Flag | Description |
| :--- | :--- |
| `-t, --template <name>` | Template from `templates/` library |
| `-o, --output <dir>` | Target docs directory |
| `-c, --category <name>` | Category sub-folder (e.g. `guides`, `legal`, `ddi`) |
| `-s, --subcat <name>` | Sub-category folder |
| `--title <title>` | Document title |
| `--type <type>` | Document type |
| `--status <status>` | Workflow status — default `draft` |
| `--author <preset>` | `kent` to auto-fill |
| `--tags <tags>` | Tags, space or comma separated |
| `--move <file>` | Import an existing file |
| `--copy` | When using `--move`, keep the original |
| `-f, --force` | Skip all confirmation prompts |

---

### `doc-update` — Audit and batch-fix a library

Review all docs in a library and update frontmatter to the current standard.

```zsh
# Audit only — no writes
doc-update --audit

# Audit a specific sub-directory
doc-update ./src/content/docs/legal --audit

# Auto-fix all fixable issues silently
doc-update --fix --force

# Walk each problem file interactively (default if no mode given)
doc-update --interactive

# Bulk set type and status across entire library
doc-update --type legal --status review --force
```

**Options:**

| Flag | Description |
| :--- | :--- |
| `--audit` | Report issues only — no writes |
| `--fix` | Apply all auto-fixable issues |
| `--interactive` | Walk each file with issues (default) |
| `--status <status>` | Bulk-set status |
| `--type <type>` | Bulk-set type |
| `--add-tag <tag>` | Append a tag to all files |
| `-f, --force` | Write without confirmation |

**Auto-fixable issues:**

- Missing `slug` — derived from `title`
- Invalid/missing `status` — set to `draft`
- Missing `authors` — set to Kent Schaeffer
- Legacy `author` string — migrated to `authors` array
- Missing `createdDate` / `lastUpdatedDate` — set to today
- `status: published` + `draft: true` mismatch — resolved
- Missing `editors` field — set to `[]`

**Manual issues** (prompts in `--interactive` mode):

- Invalid or missing `type`
- No frontmatter at all

---

## Template Library

Templates live in `~/git/clitools/prep-doc/templates/`. Use `--template <name>`
(without `.mdx`).

| Template | Use Case |
| :--- | :--- |
| `research` | Public academic / technical papers |
| `tech-public` | Public-facing technical guides and articles |
| `tech-internal` | Internal runbooks, how-tos, architecture docs |
| `bus-internal` | Internal business docs — strategy, plans |
| `proposal-subcontractor` | Subcontractor proposals (includes liability clause) |
| `service-agreement` | Client service agreements |
| `nda-client` | Client non-disclosure agreement |
| `nda-vendor` | Vendor non-disclosure agreement |
| `terms-of-service` | Website terms of service |
| `privacy-policy` | Privacy policy (Utah/GDPR aware) |
| `invoice` | Client invoice |
| `hr-handbook` | Employee / contractor handbook section |
| `ddi-design` | DDI architecture design specification |
| `network-topology` | Network topology reference with Mermaid diagrams |
| `runbook` | Operational automation runbook |
| `incident-report` | Post-incident / post-mortem report |
| `change-request` | Network/system change request (RFC) |
| `server-provisioning` | Linux server provisioning guide |
| `backup-recovery` | Backup and disaster recovery plan |
| `security-audit` | Security audit checklist |
| `blog-post` | Public blog post |
| `marketing-plan` | Internal marketing plan |

### Adding a template

Drop a `.mdx` file into `templates/`. Use `{content}` as the body placeholder
where converted content should be injected. Frontmatter in the template is
stripped — the CLI generates frontmatter from collected metadata.

---

## Frontmatter Schema

All fields written to D1 (`docs_pages` table). Required fields marked ✱.

| Field | Type | D1 Type | Notes |
| :--- | :--- | :--- | :--- |
| `title` ✱ | string | TEXT | Primary identifier |
| `slug` ✱ | string | TEXT | Auto-generated from title |
| `description` | string | TEXT | SEO meta |
| `type` ✱ | string | TEXT | See valid types below |
| `status` ✱ | string | TEXT | `draft` / `review` / `published` / `archived` |
| `draft` | boolean | INTEGER (0/1) | Backward compat with Starlight |
| `authors` ✱ | array | JSON | `[{name, title, org, url, email}]` |
| `editors` | array | JSON | `[{name, title, org}]` |
| `tags` | array | JSON | `["dns", "utah", …]` |
| `createdDate` ✱ | date | TEXT (ISO) | `YYYY-MM-DD` |
| `publishDate` | date | TEXT (ISO) | Set when status → published |
| `lastUpdatedDate` ✱ | date | TEXT (ISO) | Updated on every write |
| `nextReviewDate` | date | TEXT (ISO) | Reminder for doc review |
| `version` | string | TEXT | `1.0.0` |
| `abstract` | string | TEXT | Research papers |
| `keywords` | array | JSON | Academic indexing |
| `doi` | string | TEXT | Publications |
| `license` | string | TEXT | `MIT`, `CC-BY-4.0`, `Proprietary` |
| `limitation_of_liability` | boolean | INTEGER | `1` if clause is present |
| `mermaid_diagram` | string | TEXT | Raw Mermaid syntax |
| `prerequisites` | array | JSON | Runbooks / how-tos |
| `summary` | string | TEXT | Business docs |

**Valid types:** `article`, `blog`, `business-plan`, `checklist`, `design`,
`how-to`, `hr`, `invoice`, `legal`, `marketing-plan`, `plan`, `proposal`,
`reference`, `report`, `research`, `rfc`, `runbook`, `agreement`

---

## Common Workflows

### After editing a doc

```zsh
doc-prep ./path/to/file.mdx --stamp
```

### Preparing a new proposal

```zsh
doc-create --template proposal-subcontractor \
  --category legal --subcat proposals \
  --author kent --type proposal
```

### Importing a Word doc

```zsh
doc-convert client-notes.docx --template tech-internal \
  --author kent --category clients
```

### Auditing the whole library before a release

```zsh
doc-update --audit
# review output
doc-update --fix --force
# handle any manual issues
doc-update --interactive
```

---

## Uninstall

```zsh
cd ~/git/clitools/prep-doc
npm unlink
```

---

## Dependencies

| Package | Purpose |
| :--- | :--- |
| `commander` | CLI argument parsing |
| `js-yaml` | Frontmatter serialization |
| `glob` | File pattern matching |
| `picocolors` | Terminal color output |
| `pandoc` (system) | Document format conversion |
