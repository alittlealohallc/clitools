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

log_info() {
    print -P "%F{blue}[INFO]%f %B$1%b"
}

log_warn() {
    print -P "%F{yellow}[WARN]%f %B$1%b"
}

log_error() {
    print -P "%F{red}[ERROR]%f %B$1%b"
    exit 1
}

check_template() {
    if [[ ! -d "$TEMPLATE_DIR" ]]; then
        log_error "Template directory not found at: $TEMPLATE_DIR"
    fi
    if [[ ! -f "$TEMPLATE_DIR/.husky/pre-commit" ]]; then
        log_error "Template hook '.husky/pre-commit' not found in $TEMPLATE_DIR"
    fi
}

setup_symlink() {
    log_info "Setting up symlink to $SYMLINK_PATH..."

    mkdir -p "$BIN_DIR"

    if [[ -L "$SYMLINK_PATH" ]]; then
        rm "$SYMLINK_PATH"
        log_info "Removed old symlink."
    elif [[ -e "$SYMLINK_PATH" ]]; then
        log_warn "File exists at $SYMLINK_PATH but is not a symlink. Removing it."
        rm "$SYMLINK_PATH"
    fi

    ln -s "$SCRIPT_PATH" "$SYMLINK_PATH"
    log_info "Symlink created: '$SCRIPT_NAME' is now available globally."

    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        log_warn "$BIN_DIR is not in your PATH. Add this to your ~/.zshrc:"
        print "  export PATH=\"\$HOME/bin:\$PATH\""
    fi
}

run_setup() {
    local target_dir="$1"

    if [[ ! -d "$target_dir" ]]; then
        log_error "Target directory does not exist: $target_dir"
    fi

    if [[ ! -f "$target_dir/package.json" ]]; then
        log_error "No package.json found in $target_dir. Expected a Node.js project."
    fi

    log_info "Processing: $target_dir"
    cd "$target_dir"

    # 1. Install husky if not already a dependency
    if ! grep -q '"husky"' package.json 2>/dev/null; then
        log_info "Installing husky..."
        npm install --save-dev husky
    else
        log_info "Husky dependency already present."
    fi

    # 2. Initialize Husky
    if [[ ! -d ".husky" ]]; then
        log_info "Initializing Husky..."
        npx husky init
    else
        log_info "Husky directory already exists."
    fi

    # 3. Copy template hooks
    log_info "Injecting template hooks..."
    cp "$TEMPLATE_DIR/.husky/pre-commit"  .husky/pre-commit
    cp "$TEMPLATE_DIR/.husky/post-commit" .husky/post-commit
    cp "$TEMPLATE_DIR/.husky/commit-msg"  .husky/commit-msg

    chmod +x .husky/pre-commit .husky/post-commit .husky/commit-msg

    # 4. Copy patch script
    log_info "Copying scripts..."
    mkdir -p scripts
    cp "$TEMPLATE_DIR/scripts/generate-patch.sh" scripts/generate-patch.sh
    chmod +x scripts/generate-patch.sh

    # 5. Ensure prepare script is present in package.json
    log_info "Ensuring 'prepare' script in package.json..."
    node --input-type=commonjs <<'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
if (!pkg.scripts.prepare || !pkg.scripts.prepare.includes('husky')) {
    pkg.scripts.prepare = 'husky';
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
    console.log('Added prepare script.');
} else {
    console.log('prepare script already set.');
}
EOF

    log_info "Setup complete for: $target_dir"
    echo ""
}

# --- Main ---

if [[ $# -eq 0 ]]; then
    log_error "Usage: $SCRIPT_NAME --setup | <directory> [directory ...]"
fi

if [[ "$1" == "--setup" ]]; then
    check_template
    setup_symlink
    exit 0
fi

check_template

for dir in "$@"; do
    run_setup "$dir"
done

log_info "Huskified! All done."
