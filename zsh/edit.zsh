#!/usr/bin/env zsh
# edit.zsh - Wrapper for /usr/local/bin/cot with file creation and setup capabilities
# Location: ~/git/clitools/zsh/edit.zsh
# Author: Kent Schaeffer

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COT_BIN="/usr/local/bin/cot"
SETUP_FLAG="--setup"
SYMLINK_TARGET="$HOME/bin/edit"

# Function to display usage
usage() {
    cat <<EOF
Usage: $(basename "$0") [--setup] || [file1 file2 ...]

Options:
  --setup    Create a symlink at $SYMLINK_TARGET pointing to this script.
             This allows you to run 'edit' from anywhere in your PATH.

Arguments:
  One or more files to pass to /usr/local/bin/cot.
  If a file does not exist, it will be created as an empty file before execution.

Example:
  $(basename "$0") --setup
  $(basename "$0") config.yaml data.json
EOF
    exit 1
}

# Parse arguments
if [[ $# -eq 0 ]]; then
    usage
fi

# Handle --setup flag
if [[ "$1" == "$SETUP_FLAG" ]]; then
    # Ensure the bin directory exists
    mkdir -p "$HOME/bin"
    
    # Remove existing symlink if it points elsewhere or is broken
    if [[ -L "$SYMLINK_TARGET" ]]; then
        rm "$SYMLINK_TARGET"
    elif [[ -e "$SYMLINK_TARGET" ]]; then
        echo "Error: $SYMLINK_TARGET exists but is not a symlink. Aborting setup." >&2
        exit 1
    fi
    
    # Create the symlink
    ln -sf "$SCRIPT_DIR/edit.zsh" "$SYMLINK_TARGET"
    echo "Symlink created: $SYMLINK_TARGET -> $SCRIPT_DIR/edit.zsh"
    echo "Ensure $HOME/bin is in your \$PATH. Add 'export PATH=\$HOME/bin:\$PATH' to ~/.zshrc if needed."
    exit 0
fi

# Validate that /usr/local/bin/cot exists
if [[ ! -x "$COT_BIN" ]]; then
    echo "Error: Cot binary not found or not executable at $COT_BIN" >&2
    exit 1
fi

# Process file arguments: create if missing, then pass to cot
files=()
for arg in "$@"; do
    if [[ ! -e "$arg" ]]; then
        # Create the file if it doesn't exist
        touch "$arg"
        echo "Created missing file: $arg"
    fi
    files+=("$arg")
done

# Execute the actual cot command
exec "$COT_BIN" "${files[@]}"