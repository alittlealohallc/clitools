#!/usr/bin/env zsh
set -e

PATCH_DIR=".patches"
mkdir -p "$PATCH_DIR"

COMMIT_HASH=$(git rev-parse --short HEAD)
PATCH_FILE="${PATCH_DIR}/${COMMIT_HASH}.patch"

git diff HEAD~1 HEAD > "$PATCH_FILE"
echo "Patch generated: $PATCH_FILE"
