#!/usr/bin/env zsh
set -e

patch_dir=".patches"
mkdir -p "$patch_dir"

commit_hash=$(git rev-parse --short HEAD)
patch_file="${patch_dir}/${commit_hash}.patch"

git diff HEAD~1 HEAD > "$patch_file"
echo "Patch generated: $patch_file"
