#!/usr/bin/env zsh
# huskify.zsh - Automated Husky & Monorepo Setup Script

set -e

# --- Global Path Resolution (Captured BEFORE function definition) ---
# $0 is the script name. dirname resolves the directory. cd + pwd makes it absolute.
# This works regardless of where the script is called from.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "$0")"

# --- Configuration ---
SCRIPT_NAME="huskify"
TEMPLATE_DIR="$HOME/git/clitools/git/husky"
BIN_DIR="$HOME/bin"
SYMLINK_PATH="$BIN_DIR/$SCRIPT_NAME"

# --- Helper Functions ---

log_info() {
    print -P "%F{blue}[INFO]%f %B$1%B"
}

log_warn() {
    print -P "%F{yellow}[WARN]%f %B$1%B"
}

log_error() {
    print -P "%F{red}[ERROR]%f %B$1%B"
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
    
    # Use the globally resolved SCRIPT_PATH instead of $0
    ln -s "$SCRIPT_PATH" "$SYMLINK_PATH"
    log_info "Symlink created successfully. You can now run '$SCRIPT_NAME' from anywhere."
    
    # Ensure ~/bin is in PATH if not already
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        log_warn "Warning: $BIN_DIR is not in your PATH. Add this to your ~/.zshrc:"
        print "export PATH=\"\$HOME/bin:\$PATH\""
    fi
}

run_setup() {
    local target_dir="$1"
    
    if [[ ! -d "$target_dir" ]]; then
        log_error "Target directory does not exist: $target_dir"
    fi
    
    if [[ ! -f "$target_dir/package.json" ]]; then
        log_error "No package.json found in $target_dir. This script expects a Node.js project."
    fi

    log_info "Processing: $target_dir"
    cd "$target_dir"

    # 0. Clean up old changesets setup
    log_info "Cleaning up old changesets configuration..."
    rm -rf .changeset 2>/dev/null || true
    npm uninstall @changesets/cli 2>/dev/null || true

    # 1. Install Husky
    log_info "Checking dependencies..."
    if ! grep -q '"husky"' package.json 2>/dev/null; then
        log_info "Installing husky..."
        npm install --save-dev husky
    else
        log_info "Husky already installed."
    fi

    # 2. Initialize Husky (creates .husky if missing)
    if [[ ! -d ".husky" ]]; then
        log_info "Initializing Husky..."
        npx husky init
    else
        log_info "Husky directory already exists."
    fi

    # 3. Copy Template Hooks
    log_info "Injecting template hooks..."
    cp "$TEMPLATE_DIR/.husky/pre-commit" .husky/pre-commit
    cp "$TEMPLATE_DIR/.husky/post-commit" .husky/post-commit
    cp "$TEMPLATE_DIR/.husky/commit-msg" .husky/commit-msg
    
    # Set execute permissions
    chmod +x .husky/pre-commit
    chmod +x .husky/post-commit
    chmod +x .husky/commit-msg
    
    log_info "Setup complete for: $target_dir"
    echo ""
}

# --- Main Logic ---

if [[ $# -eq 0 ]]; then
    log_error "Usage: $SCRIPT_NAME [--setup] | [directory1] [directory2] ..."
    exit 1
fi

if [[ "$1" == "--setup" ]]; then
    check_template
    setup_symlink
    exit 0
fi

# Process directories
check_template

if [[ "$1" == "." ]] || [[ "$#" -eq 0 ]]; then
    # Default to current directory if no args or explicit '.'
    run_setup "."
else
    # Process all provided arguments
    for dir in "$@"; do
        run_setup "$dir"
    done
fi

log_info "Huskified! All operations finished."
