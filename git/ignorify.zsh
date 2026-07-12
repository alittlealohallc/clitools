#!/usr/bin/env zsh
# ignorify.zsh - Normalize global + repo-local .gitignore* using a canonical template

setopt errexit nounset pipefail extended_glob
IFS=$'\n\t'

# --- Logging ---
log_info()  { print -P "%F{blue}[INFO]%f %B$1%b" }
log_warn()  { print -P "%F{yellow}[WARN]%f %B$1%b" }
log_ok()    { print -P "%F{green}[ OK ]%f %B$1%b" }
log_error() { print -P "%F{red}[ERROR]%f %B$1%b"; exit 1 }

usage() {
  print "Usage:"
  print "  ignorify --setup"
  print "  ignorify --dir <path> [--yes]"
  print ""
  print "Options:"
  print "  --dir <path>   Run against the git repo containing <path> (or <path> itself)."
  print "  --yes          Do not prompt for unsafe .gitignore* operations."
  print "  --setup        Create symlink at ~/bin/ignorify -> ~/git/clitools/git/ignorify.zsh"
}

setup() {
  local bin_link="$HOME/bin/ignorify"
  local target="$HOME/git/clitools/git/ignorify.zsh"

  mkdir -p "$HOME/bin"
  if [[ -e "$bin_link" && ! -L "$bin_link" ]]; then
    log_warn "Non-symlink exists at $bin_link - removing."
    rm -f "$bin_link"
  elif [[ -L "$bin_link" ]]; then
    rm -f "$bin_link"
  fi

  ln -s "$target" "$bin_link"
  log_ok "Symlink created: $bin_link -> $target"
}

# ---- Template: best-practice .gitignore_global + required husky_block ----
# Lines that must always be present in the global template so that repo-local
# ignore files never need to duplicate husky-specific ignore rules.
husky_block=(
  "# husky"
  ".patches/"
  ".husky/.version-type"
)

# Patterns that must NEVER be ignored, because Husky hooks/scripts must be
# tracked in git for the setup to work on a fresh clone.
husky_protected_patterns=(
  ".husky"
  ".husky/"
  "/.husky"
  "/.husky/"
)

# Canonical global template patterns (keeps comments meaningful)
template_content() {
  cat <<EOF
# Global ignore for editor/OS noise + common generated artifacts
# Keep project-specific rules in repo-local .gitignore.

# macOS
.DS_Store
.AppleDouble
.LSOverride
Icon?
._*

# Windows (usually)
Thumbs.db
ehthumbs.db

# IDEs
.vscode/
.idea/

# Shell/editor junk
*~
*.swp

# Logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# Node ecosystem
node_modules/
.pnpm-store/
dist/
build/
coverage/
.nyc_output/
*.tsbuildinfo

# Common framework caches
.cache/
.turbo/
.next/
.nuxt/
.svelte-kit/

# Env/secrets (local machine-only)
.env
.env.*
!.env.example

# Husky-generated patches
${(F)husky_block}
EOF
}

normalize_pattern() {
  # input: one line
  local s="$1"
  s="${s//$'\r'/}"
  # trim leading/trailing whitespace
  s="${s##[[:space:]]#}"
  s="${s%%[[:space:]]#}"
  [[ -z "$s" ]] && return 1
  [[ "${s[1]}" == "#" ]] && return 1
  print -r -- "$s"
}

is_husky_protected_pattern() {
  local p="$1" prot
  for prot in "${husky_protected_patterns[@]}"; do
    [[ "$p" == "$prot" ]] && return 0
  done
  return 1
}

ordered_patterns_from_file() {
  # args: file
  local f="$1"
  local line norm
  typeset -A seen=()
  if [[ -f "$f" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      norm="$(normalize_pattern "$line" || true)"
      [[ -z "${norm:-}" ]] && continue
      if [[ -z "${seen[$norm]:-}" ]]; then
        seen["$norm"]=1
        print -r -- "$norm"
      fi
    done < "$f"
  fi
}

get_repo_root() {
  local dir="$1"
  local repo_root
  repo_root="$(cd "$dir" && git rev-parse --show-toplevel 2>/dev/null)" || return 1
  print -r -- "$repo_root"
}

get_global_excludes_file() {
  # authoritative: git config --global core.excludesfile if set, else default path
  local p
  p="$(git config --global --get core.excludesfile 2>/dev/null || true)"
  if [[ -n "$p" ]]; then
    print -r -- "$p"
    return 0
  fi
  print -r -- "$HOME/git/.gitignore_global"
}

# ---- Safety prompt handling ----
need_changes=0
assume_yes=""
unsafe_prompt() {
  if (( need_changes == 1 )); then
    if [[ -z "$assume_yes" ]]; then
      if [[ -t 0 ]]; then
        print -r -n "About to create/edit/delete .gitignore* files. Continue? [y/N] "
        local ans=""
        IFS= read -r ans || true
        case "${ans:l}" in
          y|yes) ;;
          *) log_warn "Aborted."; exit 1 ;;
        esac
      else
        log_warn "No TTY and changes required; aborting. Re-run with --yes."
        exit 1
      fi
    fi
  fi
}

normalize_pattern_list_from_text() {
  # stdin: text; stdout: normalized pattern lines (non-comment/blank)
  local line norm
  while IFS= read -r line || [[ -n "$line" ]]; do
    norm="$(normalize_pattern "$line" || true)"
    [[ -z "${norm:-}" ]] && continue
    print -r -- "$norm"
  done
}

# ---- Main normalization ----
apply_global_template() {
  local global_file="$1"

  mkdir -p "$(dirname "$global_file")"
  [[ -f "$global_file" ]] || touch "$global_file"

  # Build canonical output:
  # - template content (canonical, includes husky_block)
  # - then append any existing global patterns not already in template
  local tmp tpl_filelist
  tmp="$(mktemp -t ignorify-global.XXXXXX)"
  tpl_filelist="$(mktemp -t ignorify-template.XXXXXX)"
  template_content >"$tpl_filelist"

  # template patterns set
  local pat
  typeset -A tpl_set=()
  while IFS= read -r pat; do
    [[ -z "$pat" ]] && continue
    tpl_set["$pat"]=1
  done < <(normalize_pattern_list_from_text < "$tpl_filelist")

  # ordered extra patterns from existing global
  local extra_patterns
  extra_patterns="$(
    ordered_patterns_from_file "$global_file" | while IFS= read -r p; do
      [[ -z "$p" ]] && continue
      if [[ -z "${tpl_set[$p]:-}" ]]; then
        print -r -- "$p"
      fi
    done
  )"

  # Write output
  {
    cat "$tpl_filelist"
    if [[ -n "$extra_patterns" ]]; then
      print ""
      print "# Extra global patterns (kept as-is)"
      print -r -- "$extra_patterns"
      print ""
    fi
  } >"$tmp"

  # replace only if changed
  if ! cmp -s "$tmp" "$global_file"; then
    need_changes=1
    unsafe_prompt
    mv -f "$tmp" "$global_file"
    log_ok "Global ignore updated: $global_file"
  else
    rm -f "$tmp"
  fi

  rm -f "$tpl_filelist"
}

apply_repo_local_cleanup() {
  local repo_root="$1"
  local global_file="$2"

  # Candidate repo-local ignore files within repo_root only
  local -a repo_ignores=()
  while IFS= read -r f; do
    repo_ignores+=("$repo_root/$f")
  done < <(
    cd "$repo_root" && \
    find . -name '.gitignore*' -not -path '*/node_modules/*' -print | sed 's#^\./##'
  )

  if (( ${#repo_ignores[@]} == 0 )); then
    log_info "No repo-local .gitignore* found under $repo_root"
    return 0
  fi

  # Set of patterns already covered by global
  local -a ordered_global_patterns
  ordered_global_patterns=()
  while IFS= read -r p; do
    ordered_global_patterns+=("$p")
  done < <(ordered_patterns_from_file "$global_file")

  typeset -A global_set=()
  local p
  for p in "${ordered_global_patterns[@]}"; do global_set["$p"]=1; done

  # Process each repo-local ignore file
  for gi in "${repo_ignores[@]}"; do
    [[ -f "$gi" ]] || continue

    local tmp
    tmp="$(mktemp -t ignorify-repo.XXXXXX)"

    {
      local line norm

      while IFS= read -r line || [[ -n "$line" ]]; do
        norm="$(normalize_pattern "$line" || true)"
        if [[ -z "${norm:-}" ]]; then
          # comments/blanks: keep (harmless) for readability
          print -r -- "$line"
          continue
        fi

        # Never let a repo-local rule exclude .husky from tracking
        if is_husky_protected_pattern "$norm"; then
          continue
        fi

        if [[ -n "${global_set[$norm]:-}" ]]; then
          # Drop duplicate pattern covered by global
          continue
        else
          print -r -- "$norm"
        fi
      done < "$gi"
    } >"$tmp"

    # Determine if tmp contains any pattern lines
    local has_patterns=0
    while IFS= read -r line || [[ -n "$line" ]]; do
      norm="$(normalize_pattern "$line" || true)"
      [[ -n "${norm:-}" ]] && { has_patterns=1; break; }
    done <"$tmp"

    if (( has_patterns == 0 )); then
      if [[ -n "$(cat "$gi")" ]]; then
        need_changes=1
        unsafe_prompt
        rm -f "$gi"
        log_ok "Removed repo-local ignore (covered by global): $gi"
      fi
      rm -f "$tmp"
    else
      if ! cmp -s "$tmp" "$gi"; then
        need_changes=1
        unsafe_prompt
        mv -f "$tmp" "$gi"
        log_ok "Repo-local ignore updated (deduped vs global, .husky protected): $gi"
      else
        rm -f "$tmp"
      fi
    fi
  done
}

main() {
  local dir_arg=""

  while (( $# )); do
    case "$1" in
      --setup)
        setup; exit 0
        ;;
      --dir)
        shift
        dir_arg="${1:-}"
        ;;
      --yes)
        assume_yes="1"
        ;;
      --help|-h)
        usage; exit 0
        ;;
      *)
        log_error "Unknown arg: $1"
        ;;
    esac
    shift || true
  done

  [[ -n "$dir_arg" ]] || { usage; exit 1; }

  local repo_root
  repo_root="$(get_repo_root "$dir_arg")" || log_error "Not inside a git repo: $dir_arg"

  local global_file
  global_file="$(get_global_excludes_file)"

  log_info "Repo root: $repo_root"
  log_info "Global ignore file: $global_file"

  # 1) Apply canonical template to global ignore (authoritative)
  apply_global_template "$global_file"

  # 2) Cleanup repo-local ignore files: dedupe vs global, keep .husky tracked
  apply_repo_local_cleanup "$repo_root" "$global_file"
}

main "$@"
