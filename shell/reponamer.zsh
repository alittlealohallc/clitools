#!/usr/bin/env zsh
# reponamer.zsh - Renames a current GitHub Repository
# Location: $HOME/git/clitools/shell/reponamer.zsh
# Author: Kent Schaeffer

old_dir=""
new_dir=""


# ---------- terminal message helper functions ----------
die() {
  local msg_type="${1:-error}"
  local msg="${2:-An error occurred}"
  usage "$msg_type" "$msg" >&2
  exit 1
}

warn() {
  local msg="${1:-Warning}"
  echo -e "${YELLOW}WARNING: ${msg}${NC}" >&2
}

info() {
  local msg="${1:-Info}"
  echo -e "${BLUE}INFO:  ${msg}${NC}"
}

vlog() {
  if [[ $verbose -eq 1 ]]; then
    echo -e "${BLUE}[DEBUG]${NC} $*" >&2
  fi
}

vlog_section() {
  if [[ $verbose -eq 1 ]]; then
    echo "" >&2
    echo -e "${BLUE}[DEBUG]${NC} --- $*" >&2
  fi
}


# ---------- prep functions ----------

to_lower_case() {
	lowered="$1"
	lowered="$(echo "$s" | tr '[:upper:]' '[:lower:]')"
	echo "$lowered"
}

OLD_DIR="OLD_NAME" 
NEW_DIR="NEW_NAME" 
NEW_REMOTE_URL="https://github.com/OWNER/NEW_NAME.git" \
&& mv "$OLD_DIR" "$NEW_DIR" \
&& cd "$NEW_DIR" \
&& git remote set-url origin "$NEW_REMOTE_URL" \
&& git remote -v \
&& git status -sb