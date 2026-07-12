#!/usr/bin/env zsh
# huskify.zsh - Automated Husky Setup Script

setopt errexit nounset pipefail extended_glob
IFS=$'\n\t'

# --- Config ---
script_dir="$(cd "$(dirname "$0")" && pwd)"
script_path="$script_dir/$(basename "$0")"

template_dir="$HOME/git/clitools/git/husky"
bin_dir="$HOME/bin"
symlink_path="$bin_dir/huskify"

script_name="huskify"
ignorify_script="$HOME/git/clitools/git/ignorify.zsh"

# --- Logging ---
log_info()  { print -P "%F{blue}[INFO]%f %B$1%b" }
log_warn()  { print -P "%F{yellow}[WARN]%f %B$1%b" }
log_ok()    { print -P "%F{green}[ OK ]%f %B$1%b" }
log_error() { print -P "%F{red}[ERROR]%f %B$1%b"; exit 1 }

# --- Template checks ---
check_template() {
  [[ -d "$template_dir" ]] || log_error "Template directory not found: $template_dir"
  [[ -f "$template_dir/.setup/pre-commit"       ]] || log_error "Missing template: pre-commit"
  [[ -f "$template_dir/.setup/post-commit"      ]] || log_error "Missing template: post-commit"
  [[ -f "$template_dir/.setup/commit-msg"       ]] || log_error "Missing template: commit-msg"
  [[ -f "$template_dir/.setup/bump-version.cjs" ]] || log_error "Missing template: bump-version.cjs"
  [[ -f "$template_dir/.setup/generate-patch.sh" ]] || log_error "Missing template: generate-patch.sh"
}

setup_symlink() {
  local bin_link="$bin_dir/huskify"
  local target="$template_dir/huskify.zsh"

  log_info "Setting up symlink -> $bin_link"

  mkdir -p "$bin_dir"
  if [[ -e "$bin_link" && ! -L "$bin_link" ]]; then
    log_warn "Non-symlink exists at $bin_link - removing."
    rm -f "$bin_link"
  elif [[ -L "$bin_link" ]]; then
    rm -f "$bin_link"
  fi

  ln -s "$target" "$bin_link"
  log_ok "Symlink created: $bin_link -> $target"
}

# --- Repo helpers ---
is_stop_dir() {
  local d="$1" repo="$2"
  [[ "$d" == "$HOME/git/$repo" ]] && return 0
  [[ "$d" == "$HOME/git/github/$repo" ]] && return 0
  [[ "$d" == "$HOME/git/gitlab/$repo" ]] && return 0
  return 1
}

find_pkg_upwards() {
  local cur="$1"
  local repo_dir parent
  repo_dir="$(basename "$cur")"

  while :; do
    if [[ -f "$cur/package.json" ]]; then
      print -r -- "$cur/package.json"
      return 0
    fi

    is_stop_dir "$cur" "$repo_dir" && return 1

    parent="$(cd "$cur/.." && pwd -P)"
    [[ "$parent" == "$cur" ]] && return 1
    cur="$parent"
  done
}

# --- Cleanup (repo setup / re-setup, workflow step 2) ---
cleanup_legacy_husky_install() {
  log_info "Removing previous Husky install..."

  # 1. remove [local_install]/.husky recursively
  if [[ -d ".husky" ]]; then
    rm -rf ".husky"
    log_ok "Removed .husky/"
  fi

  # 2. remove [local_install]/scripts/bump-version.cjs, generate-patch.sh (pre-consolidation layout)
  local removed_script=0
  if [[ -f "scripts/bump-version.cjs" ]]; then
    rm -f "scripts/bump-version.cjs"
    removed_script=1
  fi
  if [[ -f "scripts/generate-patch.sh" ]]; then
    rm -f "scripts/generate-patch.sh"
    removed_script=1
  fi
  (( removed_script )) && log_ok "Removed legacy scripts/{bump-version.cjs,generate-patch.sh}"

  # 3. remove [local_install]/scripts folder if no other files/folders remain
  if [[ -d "scripts" ]] && [[ -z "$(ls -A scripts)" ]]; then
    rmdir "scripts"
    log_ok "Removed empty scripts/ folder"
  fi
}

cleanup_legacy_tooling() {
  log_info "Cleaning legacy artifacts..."

  [[ -d ".changeset" ]] && { rm -rf .changeset; log_ok "Removed .changeset/"; }

  # Old behavior: remove stale root .patch files (keep directory itself)
  local -a stale
  stale=( ./*.patch(N) )
  if (( ${#stale} > 0 )); then
    rm -f ./*.patch
    log_ok "Removed ${#stale} stale .patch file(s) from repo root."
  fi

  # Remove stale scripts at root package.json
  node --input-type=commonjs <<'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json','utf8'));
const stale = ['changeset','version','publish','patch'];
let changed = false;
for (const k of stale) {
  if (pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, k)) {
    delete pkg.scripts[k];
    changed = true;
  }
}
if (changed) fs.writeFileSync('./package.json', JSON.stringify(pkg,null,2)+'\n');
EOF

  if grep -q '"@changesets/cli"' package.json 2>/dev/null; then
    log_info "Uninstalling @changesets/cli..."
    npm uninstall @changesets/cli >/dev/null 2>&1 || log_warn "Could not uninstall @changesets/cli (remove manually if needed)."
  fi
}

install_husky_if_needed() {
  if ! node --input-type=commonjs <<'EOF' >/dev/null 2>&1; then
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json','utf8'));
process.exit(pkg.devDependencies && pkg.devDependencies.husky ? 0 : 1);
EOF
    log_info "Installing husky..."
    npm install --save-dev husky
  else
    log_ok "Husky dependency present."
  fi
}

init_husky() {
  log_info "Initializing Husky..."
  npx husky init >/dev/null 2>&1 || npx husky init
}

# --- Install new files into [local_install]/.husky (workflow step 3) ---
sync_hooks_and_scripts() {
  local src="$1"

  mkdir -p .husky

  cp -f "$src/.setup/pre-commit"       .husky/pre-commit
  cp -f "$src/.setup/post-commit"      .husky/post-commit
  cp -f "$src/.setup/commit-msg"       .husky/commit-msg
  cp -f "$src/.setup/bump-version.cjs"  .husky/bump-version.cjs
  cp -f "$src/.setup/generate-patch.sh" .husky/generate-patch.sh

  chmod +x .husky/pre-commit .husky/post-commit .husky/commit-msg \
           .husky/bump-version.cjs .husky/generate-patch.sh

  log_ok "Hooks and scripts synced into .husky/"
}

ensure_prepare_script() {
  node --input-type=commonjs <<'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json','utf8'));
pkg.scripts = pkg.scripts || {};
if (!pkg.scripts.prepare || !String(pkg.scripts.prepare).includes('husky')) {
  pkg.scripts.prepare = 'husky';
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('prepare script updated.');
} else {
  console.log('prepare script already OK.');
}
EOF
}

run_setup() {
  local target_arg="$1"
  local target_dir pkg_json start_dir

  target_dir="$(cd "$target_arg" && pwd -P)"
  [[ -d "$target_dir" ]] || log_error "Directory does not exist: $target_arg"

  pkg_json="$(
    if [[ -f "$target_dir/package.json" ]]; then
      print -r -- "$target_dir/package.json"
    else
      find_pkg_upwards "$target_dir" || true
    fi
  )"

  [[ -n "$pkg_json" ]] || log_error "No package.json found from: $target_dir"

  start_dir="$(dirname "$pkg_json")"
  cd "$start_dir" || exit 1
  log_info "Processing: $start_dir"

  # Guard: install-from (template_dir) and install-to (start_dir) must not be
  # the same folder, or cleanup would permanently delete the template itself.
  local template_dir_real
  template_dir_real="$(cd "$template_dir" && pwd -P)"
  if [[ "$start_dir" == "$template_dir_real" ]]; then
    log_warn "Target ($start_dir) is the Husky template itself - skipping (nothing to install)."
    echo ""
    return 0
  fi

  # 2. cleanup old installs
  cleanup_legacy_husky_install
  cleanup_legacy_tooling
  install_husky_if_needed
  init_husky

  # 3. install new files to [local_install]/.husky
  sync_hooks_and_scripts "$template_dir"
  ensure_prepare_script

  # 4. run ignorify to clean up .ignore file organization, ensure .husky tracked
  [[ -x "$ignorify_script" ]] || log_error "Missing or not executable ignorify script: $ignorify_script"
  "$ignorify_script" --dir "$start_dir" --yes

  log_ok "Setup complete: $start_dir"
  echo ""
}

usage() {
  print "Usage:"
  print "  $script_name --setup              Install global symlink to ~/bin"
  print "  $script_name <dir> [dir ...]      Apply husky config to target repo(s)"
  print "  $script_name .                    Apply to current directory"
  exit 1
}

main() {
  [[ $# -eq 0 ]] && usage

  if [[ "${1:-}" == "--setup" ]]; then
    check_template
    setup_symlink
    exit 0
  fi

  check_template

  # Prompt once before we call ignorify (unsafe .gitignore* create/edit/delete).
  if [[ -t 0 ]]; then
    print -r -n "About to create/edit/delete .gitignore* files while setting up Husky. Continue? [y/N] "
    local ans=""
    IFS= read -r ans || true
    case "${ans:l}" in
      y|yes) ;;
      *) log_warn "Aborted."; exit 1 ;;
    esac
  fi

  for dir in "$@"; do
    run_setup "$dir"
  done
  log_ok "Huskified! All done."
}

main "$@"
