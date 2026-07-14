#!/usr/bin/env zsh
set -euo pipefail

bin_dir="${BIN_DIR:-$HOME/bin}"
maxdepth="${MAXDEPTH:-10}"
fix=1
dry_run=0

# Where to try when something moved from ~/git/... to ~/git/github/... or ~/git/gitlab/...
git_base="$HOME/git"
roots=(
  "$HOME/git/github"
  "$HOME/git/gitlab"
)

usage() {
  cat <<EOF
Usage:
  relink.sh [--bin-dir DIR] [--maxdepth N] [--dry-run] [--no-fix]

Scans all entries in ~/bin and:
- For symlinks: fixes broken ones (by trying ~/git/github|gitlab remap, then a bounded search), or rebuilds if uniquely found.
- For regular files: looks for embedded absolute paths under ~/git/ that no longer exist, and updates them using the same remap/search logic.
- Prints a final per-file status report.
EOF
}

while (( $# )); do
  case "$1" in
    --bin-dir) bin_dir="${2:?missing DIR}"; shift 2 ;;
    --maxdepth) maxdepth="${2:?missing N}"; shift 2 ;;
    --dry-run) dry_run=1; fix=0; shift ;;
    --no-fix) fix=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -d "$bin_dir" ]] || { echo "bin_dir not found: $bin_dir" >&2; exit 2; }

home_git_prefix="${git_base}/"

resolve_symlink_abs() {
  local link_path="$1"
  local target
  target="$(readlink "$link_path" 2>/dev/null)" || return 1
  if [[ "$target" == /* ]]; then
    print -r -- "$target"
  else
    print -r -- "$(cd "$(dirname "$link_path")" && pwd -P)/$target"
  fi
}

remap_git_suffix_if_exists() {
  # Try ~/git/github/<suffix> and ~/git/gitlab/<suffix>
  local old_abs="$1"
  [[ "$old_abs" == "$home_git_prefix"* ]] || return 1
  local suffix="${old_abs#"$home_git_prefix"}"
  local cand

  for base in "${roots[@]}"; do
    cand="$base/$suffix"
    if [[ -e "$cand" ]]; then
      print -r -- "$cand"
      return 0
    fi
  done
  return 1
}

find_unique_by_name() {
  # bounded find; searches for a path (file or dir) with exact basename
  local name="$1"
  local found=()
  local r

  for r in "${roots[@]}" "$git_base"; do
    [[ -d "$r" ]] || continue
    # collect up to 2 matches; enough to decide uniqueness
    while IFS= read -r p; do
      found+=("$p")
      (( ${#found[@]} >= 2 )) && break
    done < <(find "$r" -maxdepth "$maxdepth" -name "$name" -print 2>/dev/null || true)

    (( ${#found[@]} >= 2 )) && break
    (( ${#found[@]} == 1 )) && break
  done

  if (( ${#found[@]} == 1 )); then
    print -r -- "${found[0]}"
    return 0
  fi
  return 1
}

fix_broken_symlink() {
  local link_path="$1"
  local link_target_abs="$2"

  # 1) Try direct remap
  if new_t="$(remap_git_suffix_if_exists "$link_target_abs" 2>/dev/null || true)"; then
    [[ -e "$new_t" ]] || true
    if [[ -e "$new_t" ]]; then
      print -r -- "$new_t"
      return 0
    fi
  fi

  # 2) Try bounded unique search by basename
  local base
  base="$(basename "$link_target_abs")"
  if new_t="$(find_unique_by_name "$base" 2>/dev/null || true)"; then
    [[ -e "$new_t" ]] || true
    if [[ -e "$new_t" ]]; then
      print -r -- "$new_t"
      return 0
    fi
  fi

  return 1
}

extract_embedded_git_paths() {
  # Outputs unique absolute paths matching "$HOME/git/...." found in the file
  local file="$1"
  local t
  t="$(perl -0777 -ne '
    use strict;
    my $home = $ENV{"HOME"};
    my %seen;
    while (m/\Q$home\E\/git\/[^\s"'\''\\)]+/g) { $seen{$&}=1; }
    print join("\n", sort keys %seen), "\n";
  ' "$file" 2>/dev/null || true)"
  [[ -n "$t" ]] && print -r -- "$t"
}

# Report buffers
typeset -a r_name r_type r_target r_status r_detail

add_report() {
  r_name+=("$1")
  r_type+=("$2")
  r_target+=("${3:-}")
  r_status+=("$4")
  r_detail+=("${5:-}")
}

# Scan ~/bin
# FIX: Use zsh setopt instead of bash shopt
setopt nullglob
for p in "$bin_dir"/*; do
  name="${p:t}"

  if [[ -L "$p" ]]; then
    if link_target_abs="$(resolve_symlink_abs "$p" 2>/dev/null || true)"; then
      if [[ -e "$link_target_abs" ]]; then
        add_report "$name" "symlink" "$link_target_abs" "OK" ""
        continue
      fi

      # Broken symlink: try fix/rebuild
      if new_t="$(fix_broken_symlink "$p" "$link_target_abs" 2>/dev/null || true)"; then
        if (( fix )); then
          if (( dry_run )); then
            add_report "$name" "symlink" "$link_target_abs" "FIX-DRYRUN" "Would retarget -> $new_t"
          else
            rm -f -- "$p"
            ln -s "$new_t" "$p"
            add_report "$name" "symlink" "$new_t" "FIXED" "Retargeted from -> $link_target_abs"
          fi
        else
          add_report "$name" "symlink" "$link_target_abs" "WOULD-FIX" "Would retarget -> $new_t"
        fi
        continue
      fi

      add_report "$name" "symlink" "$link_target_abs" "UNRESOLVED" "No remap/search target found"
    else
      add_report "$name" "symlink" "" "UNRESOLVED" "readlink failed"
    fi

  elif [[ -f "$p" ]]; then
    # Regular file: check embedded ~/git/... paths and update them
    # (bounded by file size to avoid huge/binary blobs)
    # FIX: Handle macOS/BSD stat format
    if [[ "$(uname -s)" == "Darwin" ]]; then
      size="$(stat -f %z "$p" 2>/dev/null || echo 0)"
    else
      size="$(stat -c %s "$p" 2>/dev/null || echo 0)"
    fi
    
    if (( size > 512000 )); then
      add_report "$name" "file" "" "SKIP" "File too large for in-file rewriting"
      continue
    fi

    # Build proposed replacements: old_abs -> new_abs where new exists
    local old_to_new=()
    local new_count=0
    local old_abs new_abs base pair

    while IFS= read -r old_abs; do
      [[ -n "$old_abs" ]] || continue
      [[ -e "$old_abs" ]] && continue

      if new_abs="$(remap_git_suffix_if_exists "$old_abs" 2>/dev/null || true)"; then
        if [[ -e "$new_abs" ]]; then
          old_to_new+=("$old_abs::$new_abs")
          (( new_count++ )) || true
          continue
        fi
      fi

      # If remap failed, try bounded unique search by basename
      base="$(basename "$old_abs")"
      if new_abs="$(find_unique_by_name "$base" 2>/dev/null || true)"; then
        if [[ -e "$new_abs" ]]; then
          old_to_new+=("$old_abs::$new_abs")
          (( new_count++ )) || true
        fi
      fi
    done < <(extract_embedded_git_paths "$p")

    if (( new_count == 0 )); then
      add_report "$name" "file" "" "OK" "No stale ~/git paths found"
      continue
    fi

    if (( fix )); then
      if (( dry_run )); then
        add_report "$name" "file" "" "FIX-DRYRUN" "Would update $new_count path(s)"
      else
        local tmp
        tmp="$(mktemp)"
        # Perform literal string replacements for each proposed old->new
        cp -- "$p" "$tmp"
        for pair in "${old_to_new[@]}"; do
          old_abs="${pair%%::*}"
          new_abs="${pair#*::}"
          # FIX: Escape special chars for perl s/// command
          local escaped_old escaped_new
          escaped_old=$(printf '%s\n' "$old_abs" | sed 's/[\/&]/\\&/g')
          escaped_new=$(printf '%s\n' "$new_abs" | sed 's/[\/&]/\\&/g')
          perl -pi -e "s/${escaped_old}/${escaped_new}/g" "$tmp"
        done
        mv -- "$tmp" "$p"
        add_report "$name" "file" "" "FIXED" "Updated $new_count path(s)"
      fi
    else
      add_report "$name" "file" "" "WOULD-FIX" "Stale ~/git path(s) detected: $new_count"
    fi

  else
    # Non-symlink, non-regular file
    add_report "$name" "other" "" "SKIP" "Not a regular file or symlink"
  fi
done

# Final status report
printf "\n%-15s %-10s %-55s %-9s %s\n" "NAME" "TYPE" "TARGET" "STATUS" "DETAIL"
printf "%s\n" "---------------------------------------------------------------------------------------------------------"

# FIX: Use zsh-compatible loop with correct array indexing
if (( ${#r_name[@]} > 0 )); then
  for (( i=1; i<=${#r_name[@]}; i++ )); do
    printf "%-15s %-10s %-55s %-9s %s\n" \
      "${r_name[$i]}" \
      "${r_type[$i]}" \
      "${r_target[$i]:-}" \
      "${r_status[$i]}" \
      "${r_detail[$i]:-}"
  done
fi
echo