#!/usr/bin/env zsh
# huskify.zsh - Automated Husky Setup Script

set -e

# --- Global Path Resolution ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "$0")"

# --- Configuration ---
SCRIPT_NAME="huskify"
TEMPLATE_DIR="$HOME/git/clitools/git/husky"
BIN_DIR="$HOME/bin"
SYMLINK_PATH="$BIN_DIR/$SCRIPT_NAME"

# --- Helper Functions ---

log_info()  { print -P "%F{blue}[INFO]%f %B$1%b" }
log_warn()  { print -P "%F{yellow}[WARN]%f %B$1%b" }
log_ok()    { print -P "%F{green}[ OK ]%f %B$1%b" }
log_error() { print -P "%F{red}[ERROR]%f %B$1%b"; exit 1 }

check_template() {
    [[ -d "$TEMPLATE_DIR" ]]           || log_error "Template directory not found: $TEMPLATE_DIR"
    [[ -f "$TEMPLATE_DIR/.husky/pre-commit" ]] || log_error "Template hook pre-commit not found in $TEMPLATE_DIR"
    [[ -f "$TEMPLATE_DIR/scripts/bump-version.cjs" ]] || log_error "Template script bump-version.cjs not found in $TEMPLATE_DIR/scripts"
}

setup_symlink() {
    log_info "Setting up symlink → $SYMLINK_PATH"
    mkdir -p "$BIN_DIR"

    if [[ -L "$SYMLINK_PATH" ]]; then
        rm "$SYMLINK_PATH"
        log_info "Removed stale symlink."
    elif [[ -e "$SYMLINK_PATH" ]]; then
        log_warn "Non-symlink file at $SYMLINK_PATH — removing."
        rm "$SYMLINK_PATH"
    fi

    ln -s "$SCRIPT_PATH" "$SYMLINK_PATH"
    log_ok "Symlink created: run '$SCRIPT_NAME' from anywhere."

    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        log_warn "$BIN_DIR not in PATH. Add to ~/.zshrc:"
        print "  export PATH=\"\$HOME/bin:\$PATH\""
    fi
}

cleanup_legacy() {
    log_info "Cleaning up legacy artifacts..."

    # Remove changeset directory and config
    if [[ -d ".changeset" ]]; then
        rm -rf .changeset
        log_ok "Removed .changeset/"
    fi

    # Remove stale .patches files at repo root (old behavior dumped them here)
    local stale_patches=( ./*.patch(N) )
    if (( ${#stale_patches} > 0 )); then
        rm -f ./*.patch
        log_ok "Removed ${#stale_patches} stale .patch file(s) from repo root."
    fi

    # Ensure .patches/ dir is gitignored
    if [[ -f ".gitignore" ]]; then
        if ! grep -qx '.patches/' .gitignore 2>/dev/null; then
            echo '.patches/' >> .gitignore
            log_ok "Added .patches/ to .gitignore"
        fi
        if ! grep -qx '.husky/.version-type' .gitignore 2>/dev/null; then
            echo '.husky/.version-type' >> .gitignore
            log_ok "Added .husky/.version-type to .gitignore"
        fi
    else
        printf '.patches/\n.husky/.version-type\n' > .gitignore
        log_ok "Created .gitignore with patch and husky entries."
    fi

    # Remove @changesets/cli if present in package.json devDependencies
    if grep -q '@changesets/cli' package.json 2>/dev/null; then
        log_info "Uninstalling @changesets/cli..."
        npm uninstall @changesets/cli 2>/dev/null || log_warn "npm uninstall failed — remove @changesets/cli from package.json manually."
        log_ok "Removed @changesets/cli."
    fi
}

run_setup() {
    local target_dir
    target_dir="$(cd "$1" && pwd)"   # always resolve to absolute path

    [[ -d "$target_dir" ]]           || log_error "Directory does not exist: $target_dir"
    [[ -f "$target_dir/package.json" ]] || log_error "No package.json in $target_dir"

    log_info "Processing: $target_dir"
    cd "$target_dir"

    # 1. Cleanup legacy artifacts first
    cleanup_legacy

    # 2. Install husky if missing
    if ! grep -q '"husky"' package.json 2>/dev/null; then
        log_info "Installing husky..."
        npm install --save-dev husky
    else
        log_ok "Husky dependency present."
    fi

    # 3. Initialize Husky if .husky dir is missing
    if [[ ! -d ".husky" ]]; then
        log_info "Initializing Husky..."
        npx husky init
    else
        log_ok ".husky/ directory exists."
    fi

    # 4. Copy and chmod all template hooks
    log_info "Syncing hooks from template..."
    cp "$TEMPLATE_DIR/.husky/pre-commit"  .husky/pre-commit
    cp "$TEMPLATE_DIR/.husky/post-commit" .husky/post-commit
    cp "$TEMPLATE_DIR/.husky/commit-msg"  .husky/commit-msg
    chmod +x .husky/pre-commit .husky/post-commit .husky/commit-msg
    log_ok "Hooks synced: pre-commit, post-commit, commit-msg"

    # 5. Copy all scripts (generate-patch.sh + bump-version.cjs)
    log_info "Syncing scripts..."
    mkdir -p scripts
    cp "$TEMPLATE_DIR/scripts/generate-patch.sh" scripts/generate-patch.sh
    cp "$TEMPLATE_DIR/scripts/bump-version.cjs"  scripts/bump-version.cjs
    chmod +x scripts/generate-patch.sh scripts/bump-version.cjs
    log_ok "Scripts synced: generate-patch.sh, bump-version.cjs"

    # 6. Ensure prepare script in package.json
    log_info "Checking 'prepare' script in package.json..."
    node --input-type=commonjs <<'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
if (!pkg.scripts.prepare || !pkg.scripts.prepare.includes('husky')) {
    pkg.scripts.prepare = 'husky';
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
    process.stdout.write('Added prepare script.\n');
} else {
    process.stdout.write('prepare script already set.\n');
}
EOF

    log_ok "Setup complete: $target_dir"
    echo ""
}

# --- Usage ---

usage() {
    print "Usage:"
    print "  $SCRIPT_NAME --setup              Install global symlink to ~/bin"
    print "  $SCRIPT_NAME <dir> [dir ...]      Apply husky config to target repo(s)"
    print "  $SCRIPT_NAME .                    Apply to current directory"
    exit 1
}

# --- Main ---

[[ $# -eq 0 ]] && usage

if [[ "$1" == "--setup" ]]; then
    check_template
    setup_symlink
    exit 0
fi

check_template

for dir in "$@"; do
    run_setup "$dir"
done

log_ok "Huskified! All done."