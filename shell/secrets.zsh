#!/usr/bin/env zsh
# secrets.zsh - Secret management for Cloudflare Workers and GitHub Actions
# Location: $HOME/git/clitools/shell/secrets.zsh
# Author: Kent Schaeffer

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

platform=""
repo=""
worker=""
secrets_arg=""
secrets_csv=""
show_secret=""
setup_flag=""
account=""
kcprefix="secrets"
kc_label_prefix="Generated secret"
script_name="$(basename "$0")"
verbose=0
assume_yes=0
verify_mode=0

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

# ---------- usage ----------
usage() {
  local msg_type="${1:-}"
  local msg="${2:-}"
  local header_line=""

  case "$msg_type" in
    error)
      header_line="${RED}ERROR: ${msg}${NC}" ;;
    warn)
      header_line="${YELLOW}WARNING:  ${msg}${NC}" ;;
    info)
      header_line="${BLUE}INFO:  ${msg}${NC}" ;;
    success)
      header_line="${GREEN}SUCCESS:  ${msg}${NC}" ;;
    "")
      header_line="" ;;
    *)
      header_line="$msg" ;;
  esac

  if [[ -n "$header_line" ]]; then
    echo ""
    echo -e "$header_line"
    echo ""
  fi

  cat <<EOF
${script_name} - Secret management for Cloudflare Workers and GitHub Actions

Usage: ${script_name} [OPTIONS]

Setup (run once):
  --setup                               Creates symlink in \$HOME/bin to this script

Upload Operations:
  -p, --platform <cloudflare|github>    Platform to send keys to
  -r, --repo <[host/]owner/repo>        Platform repository name
  -w, --worker <name>                   Only for cloudflare workers
  -k, --keys <comma,separated,names>    Secret key names to generate and upload
      --show-secret <SECRET_NAME>       Display stored secret from macOS login keychain
      --verify                          Verify existing secrets (don't create new ones)

CSV Mode (recommended for batch operations):
  -f, --file <secrets.csv>              Import/verify secrets from CSV file

CSV Format (headers NOT required; first row is data):
  platform,repo,worker,key1,key2,...

Notes:
  - platform: cloudflare|github
  - repo: optional (uses --repo if blank, infers from cwd for github)
  - worker: required only for cloudflare
  - key columns: secret names (any column after worker is treated as key name)
  - key secret names are converted to UPPER_SNAKE_CASE before uploading

Other Options:
  -v, --verbose                         Enable detailed debug output
  -y, --yes                             Skip confirmation prompts
  -h, --help                            Display this help message

Examples:
  ${script_name} --setup
  ${script_name} --platform github --repo owner/repo -k API_KEY,DB_URL
  ${script_name} --platform cloudflare --worker my-worker -k CF_TOKEN
  ${script_name} -f secrets.csv                          # Create/upload secrets
  ${script_name} -f secrets.csv --verify                 # Verify what exists
  ${script_name} --show-secret API_KEY --verify          # Verify single secret

Exit Codes:
  0  Success (verification passed or secrets created)
  1  Error (verification failures or creation errors)

EOF
}

# ---------- utility functions ----------
to_upper_snake() {
  local s="$1"
  s="${s//-/_}"
  s="${s//./_}"
  s="$(echo "$s" | tr '[:lower:]' '[:upper:]')"
  s="$(echo "$s" | sed -E 's/[[:space:]]+/_/g; s/[^A-Z0-9_]/_/g; s/_+/_/g; s/^_+//; s/_+$//')"
  echo "$s"
}

gen_value() {
  openssl rand -base64 48 | awk '{$1=$1};1'
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

redact_value() { echo "********"; }

split_names_csv_list() {
  local in="$1"
  awk -F',' '
    {
      for (i=1;i<=NF;i++){
        gsub(/^[[:space:]]+|[[:space:]]+$/,"",$i);
        if($i!="") print $i;
      }
    }' <<<"$in"
}

validate_secret_name() {
  local key="$1"
  [[ -n "$key" ]] || return 1
  [[ ${#key} -le 128 ]] || return 1
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || return 1
}

guardrails_common() {
  local -a bad=()
  local k
  for k in "${(@)1}"; do
    if ! validate_secret_name "$k"; then bad+=("$k"); fi
  done
  if (( ${#bad[@]} > 0 )); then
    echo "Guardrail failure: invalid secret name(s): ${bad[*]}" >&2
    exit 1
  fi
}

ensure_auth() {
  local p="$1"

  vlog "Checking auth for platform: $p"

  case "$p" in
    cloudflare)
      command -v npx >/dev/null || { echo "Missing npx" >&2; exit 1; }
      vlog "  npx found, checking wrangler whoami..."
      if ! npx wrangler whoami --json >/dev/null 2>&1; then
        echo "Cloudflare auth not detected."
        echo "Run: npx wrangler login"
        exit 1
      fi
      vlog "  wrangler auth: OK"
      ;;
    github)
      command -v gh >/dev/null || { echo "Missing gh CLI" >&2; exit 1; }
      vlog "  gh found, checking auth status..."
      if ! gh auth status >/dev/null 2>&1; then
        echo "GitHub auth not detected."
        echo "Run: gh auth login"
        exit 1
      fi
      vlog "  gh auth: OK"
      ;;
    gitlab)
      command -v glab >/dev/null || { echo "Missing glab CLI" >&2; exit 1; }
      if ! glab auth status >/dev/null 2>&1; then
        echo "GitLab auth not detected."
        echo "Run: glab auth login"
        exit 1
      fi
      ;;
    netlify)
      command -v netlify >/dev/null || { echo "Missing netlify CLI" >&2; exit 1; }
      if ! netlify status >/dev/null 2>&1; then
        echo "Netlify auth not detected."
        echo "Run: netlify login"
        exit 1
      fi
      ;;
  esac
}

run_cmd_capture_err() {
  local label="$1"; shift
  local err rc
  set +e
  err="$("$@" 2>&1)"
  rc=$?
  set -e
  if (( rc != 0 )); then
    err_lines+=("$label :: $err")
  fi
  return $rc
}

confirm() {
  local prompt="$1"

  if [[ $assume_yes -eq 1 ]]; then
    vlog "Auto-confirming: $prompt"
    return 0
  fi

  printf "%s [y/N]: " "$prompt"
  local ans
  if [[ -r /dev/tty ]]; then
    read -r ans < /dev/tty
  else
    echo "WARNING: No tty available, auto-confirming" >&2
    return 0
  fi

  case "$ans" in
    y|Y) return 0 ;;
    *) echo "Aborted."; return 1 ;;
  esac
}

# ---------- keychain storage ----------
store_to_login_keychain() {
  local p="$1" key="$2" value="$3"
  local acct="${account:-default}"

  local svc="$kcprefix:$p:$acct:$repo:$worker"
  local desc="platform=$p repo=$repo account=$acct worker=$worker"

  vlog "Storing to keychain:"
  vlog "  service: $svc:$key"
  vlog "  account: $USER"

  local sec_output
  local sec_rc
  set +e
  sec_output=$(security add-generic-password \
    -U \
    -a "$USER" \
    -s "$svc:$key" \
    -w "$value" \
    -l "$kc_label_prefix" \
    -D "$desc" \
    2>&1)
  sec_rc=$?
  set -e

  vlog "  security rc: $sec_rc"

  if [[ $sec_rc -eq 0 ]]; then
    echo -e "${GREEN}[OK]${NC} Stored $key to keychain ($svc)"
    return 0
  else
    echo -e "${RED}[FAIL]${NC} Keychain storage FAILED for $key (rc=$sec_rc): ${sec_output:0:100}" >&2
    return $sec_rc
  fi
}

show_from_login_keychain() {
  local p="$1" key="$2" svc
  local acct="${account:-default}"

  svc="$kcprefix:$p:$acct:$repo:$worker"

  vlog "Looking up keychain entry:"
  vlog "  service: $svc:$key"
  vlog "  account: $USER"

  security find-generic-password \
    -a "$USER" \
    -s "$svc:$key" \
    -w
}

# ---------- display ----------
print_table() {
  local p="$1" repo_display="$2"
  if [[ -n "$repo_display" ]]; then
    echo "Target: $p / $repo_display"
  else
    echo "Target: $p"
  fi

  printf "\n%-14s | %-40s | %s\n" "PLATFORM" "SECRET_KEY" "VALUE"
  printf "%0.s-" {1..90}; echo
  local k
  for k in "${(@)names}"; do
    printf "%-14s | %-40s | %s\n" "$p" "$k" "$(redact_value)"
  done
  echo
}

build_json_map() {
  local json="{"
  local first=1
  local k
  for k in "${(@)names}"; do
    local v="${values[$k]}"
    local ve
    ve="$(json_escape "$v")"
    if (( first )); then first=0; else json+=", "; fi
    json+="\"$k\":\"$ve\""
  done
  json+="}"
  echo "$json"
}

# ---------- verification functions ----------
verify_cloudflare_secret() {
  local worker="$1"
  local secret_name="$2"

  vlog "  Verifying Cloudflare secret: $secret_name on worker $worker"

  local secret_list
  set +e
  secret_list=$(npx wrangler secret list --name "$worker" 2>&1)
  local rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    echo "[FAIL] Cloudflare API call failed (rc=$rc)" >&2
    return 1
  fi

  if echo "$secret_list" | grep -q "\"name\": \"$secret_name\""; then
    vlog "  OK: Secret $secret_name found on Cloudflare"
    echo "[OK] Cloudflare: $secret_name present"
    return 0
  else
    vlog "  MISSING: Secret $secret_name NOT FOUND on Cloudflare"
    echo "[MISSING] Cloudflare: $secret_name not found" >&2
    return 1
  fi
}

verify_github_secret() {
  local repo="$1"
  local secret_name="$2"

  vlog "  Verifying GitHub secret: $secret_name"

  local secret_list
  set +e
  if [[ -n "$repo" ]]; then
    secret_list=$(gh secret list -R "$repo" 2>&1)
  else
    secret_list=$(gh secret list 2>&1)
  fi
  local rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    echo "[FAIL] GitHub API call failed (rc=$rc)" >&2
    return 1
  fi

  if echo "$secret_list" | grep -q "^$secret_name "; then
    vlog "  OK: Secret $secret_name found on GitHub"
    echo "[OK] GitHub: $secret_name present"
    return 0
  else
    vlog "  MISSING: Secret $secret_name NOT FOUND on GitHub"
    echo "[MISSING] GitHub: $secret_name not found" >&2
    return 1
  fi
}

verify_keychain_secret() {
  local platform="$1"
  local secret_name="$2"

  local svc="$kcprefix:$platform:${account:-default}:$repo:$worker"

  vlog "  Verifying keychain secret: $secret_name (service: $svc)"

  local value
  set +e
  value=$(security find-generic-password -a "$USER" -s "$svc:$secret_name" -w 2>&1)
  local rc=$?
  set -e

  if [[ $rc -eq 0 ]] && [[ -n "$value" ]]; then
    vlog "  OK: Secret $secret_name found in keychain"
    echo "[OK] Keychain: $secret_name present"
    return 0
  else
    vlog "  MISSING: Secret $secret_name NOT FOUND in keychain"
    echo "[MISSING] Keychain: $secret_name not found" >&2
    return 1
  fi
}

verify_single_secret() {
  local platform="$1"
  local secret_name="$2"

  local platform_ok=0
  local keychain_ok=0

  case "$platform" in
    cloudflare)
      verify_cloudflare_secret "$worker" "$secret_name" >/dev/null 2>&1 && platform_ok=1
      ;;
    github)
      verify_github_secret "$repo" "$secret_name" >/dev/null 2>&1 && platform_ok=1
      ;;
    *)
      echo "[FAIL] Unsupported platform: $platform" >&2
      return 1
      ;;
  esac

  verify_keychain_secret "$platform" "$secret_name" >/dev/null 2>&1 && keychain_ok=1

  if [[ "$platform_ok" -eq 1 ]] && [[ "$keychain_ok" -eq 1 ]]; then
    echo "[OK] $secret_name: Platform + Keychain verified"
    return 0
  elif [[ "$platform_ok" -eq 1 ]]; then
    echo "[PARTIAL] $secret_name: Platform OK, Keychain missing"
    return 1
  else
    echo "[FAIL] $secret_name: Platform missing, Keychain $([ $keychain_ok -eq 1 ] && echo 'OK' || echo 'missing')"
    return 1
  fi
}

# ---------- upload adapters ----------
upload_github() {
  local repo_display=""
  if [[ -n "$repo" ]]; then
    repo_display="$repo"
  else
    repo_display="(cwd default)"
  fi

  print_table "github" "$repo_display"

  if ! confirm "Proceed with upload to GitHub repository $repo_display?"; then
    return 1
  fi

  local k v rc=0
  for k in "${(@)names}"; do
    v="${values[$k]}"
    vlog "Setting GitHub secret: $k"
    if [[ -n "$repo" ]]; then
      if ! gh secret set "$k" --body "$v" -R "$repo" >/dev/null 2>&1; then
        echo "[FAIL] Failed to set GitHub secret: $k" >&2
        rc=1
      else
        vlog "  GitHub secret $k: OK"
      fi
    else
      if ! gh secret set "$k" --body "$v" >/dev/null 2>&1; then
        echo "[FAIL] Failed to set GitHub secret: $k" >&2
        rc=1
      else
        vlog "  GitHub secret $k: OK"
      fi
    fi
  done
  return $rc
}

upload_cloudflare() {
  print_table "cloudflare" "$worker"

  if ! confirm "Proceed with upload to Cloudflare worker $worker?"; then
    return 1
  fi

  local k v rc=0
  for k in "${(@)names}"; do
    v="${values[$k]}"

    vlog "Setting Cloudflare secret: $k"
    vlog "  value length: ${#v} chars"

    set +e
    local output
    output=$(echo "$v" | npx wrangler secret put "$k" --name "$worker" 2>&1)
    local exit_code=$?
    set -e

    vlog "  wrangler output: $output"
    vlog "  exit code: $exit_code"

    if [[ $exit_code -ne 0 ]]; then
      echo "[FAIL] Failed to set secret $k:" >&2
      echo "$output" >&2
      rc=1
    else
      vlog "  Secret $k: OK"
    fi
  done

  if [[ $rc -eq 0 ]]; then
    echo "[OK] Uploaded ${#names[@]} secrets to worker $worker"
  fi

  return $rc
}

upload_gitlab() {
  echo "[TODO] implement GitLab variable creation" >&2
  return 2
}

upload_netlify() {
  echo "[TODO] implement Netlify env var/secret creation" >&2
  return 2
}

# ---------- parse args ----------
total_args=$#

if [[ $total_args -eq 0 ]]; then
  usage "warning" "No arguments provided"
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --setup)
      setup_flag=1
      shift
      ;;
    --platform|-p)
      platform="${2:-}"
      if [[ -z "$platform" ]] && [[ -z "${2:-}" ]]; then
        usage "error" "Missing value for --platform/-p"
        exit 1
      fi
      shift 2
      ;;
    --repo|-r)
      repo="${2:-}"
      if [[ -z "$repo" ]] && [[ -z "${2:-}" ]]; then
        usage "error" "Missing value for --repo/-r"
        exit 1
      fi
      shift 2
      ;;
    --worker|-w)
      worker="${2:-}"
      if [[ -z "$worker" ]] && [[ -z "${2:-}" ]]; then
        usage "error" "Missing value for --worker/-w"
        exit 1
      fi
      shift 2
      ;;
    --keys|-k)
      secrets_arg="${2:-}"
      if [[ -z "$secrets_arg" ]] && [[ -z "${2:-}" ]]; then
        usage "error" "Missing value for --keys/-k"
        exit 1
      fi
      shift 2
      ;;
    --file|-f)
      secrets_csv="${2:-}"
      if [[ -z "$secrets_csv" ]] && [[ -z "${2:-}" ]]; then
        usage "error" "Missing value for --file/-f"
        exit 1
      fi
      shift 2
      ;;
    --show-secret)
      show_secret="${2:-}"
      if [[ -z "$show_secret" ]] && [[ -z "${2:-}" ]]; then
        usage "error" "Missing value for --show-secret"
        exit 1
      fi
      shift 2
      ;;
    --verbose|-v)
      verbose=1
      shift
      ;;
    --yes|-y)
      assume_yes=1
      shift
      ;;
    --verify)
      verify_mode=1
      shift
      ;;
    -h|--help)
      usage "info" "Usage info requested"
      exit 0
      ;;
    *)
      usage "error" "Unknown argument: $1"
      exit 1
      ;;
  esac
done

platform="$(printf '%s' "$platform" | tr '[:upper:]' '[:lower:]')"
account="${account:-default}"

# ---------- --show-secret mode ----------
if [[ -n "$show_secret" ]]; then
  vlog_section "Show Secret Mode"

  account="${account:-default}"

  case "$platform" in
    cloudflare|github|gitlab|netlify) ;;
    *) echo "Unsupported platform for --show-secret: $platform" >&2; exit 1 ;;
  esac

  [[ -n "$show_secret" ]] || { echo "Missing --show-secret <SECRET_NAME>" >&2; exit 1; }

  show_secret="$(to_upper_snake "$show_secret")"
  validate_secret_name "$show_secret" || { echo "Invalid secret name: $show_secret" >&2; exit 1; }

  [[ -n "$worker" ]] || { echo "Missing --worker for keychain lookup" >&2; exit 1; }
  [[ -n "$repo" ]] || { echo "Missing --repo for keychain lookup" >&2; exit 1; }

  vlog "Platform: $platform"
  vlog "Secret:  $show_secret"
  vlog "Account: $account"
  vlog "Repo:    $repo"
  vlog "Worker:  $worker"

  if [[ $verify_mode -eq 1 ]]; then
    verify_single_secret "$platform" "$show_secret"
    exit $?
  fi

  security_value="$(show_from_login_keychain "$platform" "$show_secret")"
  printf '%s\n' "$security_value"
  exit 0
fi

# ---------- --setup flag ----------
if [[ -n "$setup_flag" ]]; then
  vlog "Setup mode requested"

  mkdir -p "$HOME/bin"

  symlink_target="$HOME/bin/secrets"
  script_target="$HOME/git/clitools/shell/secrets.zsh"

  if [[ -L "$symlink_target" ]]; then
    rm "$symlink_target"
  elif [[ -e "$symlink_target" ]]; then
    echo "Error: $symlink_target exists but is not a symlink. Aborting setup." >&2
    exit 1
  fi

  ln -sf "$script_target" "$symlink_target"
  echo "Symlink created: $symlink_target -> $script_target"
  echo "Ensure $HOME/bin is in your \$PATH. Add 'export PATH=\$HOME/bin:\$PATH' to ~/.zshrc if needed."
  exit 0
fi

# Errors collector
typeset -a err_lines=()

# ---------- CSV mode ----------
if [[ -n "$secrets_csv" ]]; then
  vlog_section "CSV Mode"
  vlog "CSV file: $secrets_csv"
  vlog "Verify mode: $([ $verify_mode -eq 1 ] && echo 'enabled' || echo 'disabled')"

  [[ -f "$secrets_csv" ]] || { echo "CSV not found: $secrets_csv" >&2; exit 1; }

  # FIX: Removed assume_yes=1 auto-enable; confirm() reads from /dev/tty
  # so it will not consume stdin from the CSV loop
  vlog "Confirmation prompts will read from /dev/tty"

  repo_cli="$repo"
  worker_cli="$worker"

  local_line_idx=0
  row_failed=0
  total_uploaded=0
  total_failed=0
  total_verified=0
  total_missing=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    local_line_idx=$((local_line_idx+1))
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue

    vlog "Processing CSV row $local_line_idx: $(echo "$line" | sed -E 's/[^,]+/{redacted}/g')"

    IFS=',' read -r p row_repo row_worker rest <<<"$line" || true
    p="$(printf '%s' "$p" | tr '[:upper:]' '[:lower:]')"

    names=()
    while IFS= read -r name; do
      [[ -n "$name" ]] && names+=("$name")
    done < <(
      awk -F',' '
      {
        for (i=4;i<=NF;i++){
          gsub(/^[[:space:]]+|[[:space:]]+$/,"",$i);
          if($i!="") print $i;
        }
      }' <<<"$line"
    )

    if (( ${#names[@]} == 0 )); then
      vlog "  No secret names in row $local_line_idx, skipping"
      continue
    fi

    # Normalize + de-dupe
    typeset -A seen
    typeset -a final_names=()
    local raw up
    for raw in "${(@)names}"; do
      up="$(to_upper_snake "$raw")"
      [[ -n "$up" ]] || continue
      if [[ -z "${seen[$up]:-}" ]]; then
        final_names+=("$up")
        seen[$up]=1
      fi
    done
    names=("${final_names[@]}")

    guardrails_common "${names[@]}"

    # Save and restore worker/repo to prevent cross-row contamination
    saved_worker="$worker"
    saved_repo="$repo"

    if [[ -n "$row_repo" ]]; then
      repo="$row_repo"
    else
      repo="$repo_cli"
    fi

    if [[ -n "$row_worker" ]]; then
      worker="$row_worker"
    else
      worker="$worker_cli"
    fi

    if [[ -n "$row_repo" ]]; then
      repo="$row_repo"
    fi
    if [[ -n "$row_worker" ]]; then
      worker="$row_worker"
    fi

    if [[ "$p" == "cloudflare" && -z "$worker" ]]; then
      echo "CSV row $local_line_idx: missing worker for cloudflare" >&2
      row_failed=1
      total_missing=$((total_missing + ${#names[@]}))
      worker="$saved_worker"
      repo="$saved_repo"
      continue
    fi

    platform="$p"

    # ---------- VERIFY MODE ----------
    if [[ $verify_mode -eq 1 ]]; then
      vlog "  Verifying row $local_line_idx secrets..."
      row_passed=0
      row_total=${#names[@]}

      for k in "${(@)names}"; do
        if verify_single_secret "$p" "$k"; then
          row_passed=$((row_passed + 1))
          total_verified=$((total_verified + 1))
        else
          total_missing=$((total_missing + 1))
        fi
      done

      if [[ $row_passed -eq $row_total ]]; then
        echo "[OK] Row $local_line_idx: All $row_total secrets verified"
      else
        echo "[PARTIAL] Row $local_line_idx: $row_passed/$row_total secrets present" >&2
      fi

      worker="$saved_worker"
      repo="$saved_repo"
      continue
    fi

    # ---------- CREATE MODE ----------
    # Capture keychain context before upload
    local keychain_platform="$p"
    local keychain_repo="$repo"
    local keychain_worker="$worker"
    local keychain_account="${account:-default}"

    vlog "  Keychain storage context:"
    vlog "    platform=$keychain_platform repo=$keychain_repo worker=$keychain_worker account=$keychain_account"

    # Generate values once per row
    typeset -A values
    local k
    for k in "${(@)names}"; do
      values[$k]="$(gen_value)"
    done

    ensure_auth "$platform"

    row_failed=0

    case "$platform" in
      cloudflare)
        if ! run_cmd_capture_err "cloudflare::bulk" upload_cloudflare; then
          row_failed=1
        fi
        ;;
      github)
        if ! run_cmd_capture_err "github::secret-set" upload_github; then
          row_failed=1
        fi
        ;;
      gitlab)
        if ! run_cmd_capture_err "gitlab::TODO" upload_gitlab; then
          row_failed=1
        fi
        ;;
      netlify)
        if ! run_cmd_capture_err "netlify::TODO" upload_netlify; then
          row_failed=1
        fi
        ;;
      *)
        echo "CSV row $local_line_idx: unsupported platform '$platform'" >&2
        row_failed=1
        worker="$saved_worker"
        repo="$saved_repo"
        continue
        ;;
    esac

    # Store to keychain only on successful upload
    if [[ $row_failed -eq 0 ]]; then
      # Override globals with captured values for storage consistency
      local old_account="$account" old_repo="$repo" old_worker="$worker"
      account="$keychain_account"
      repo="$keychain_repo"
      worker="$keychain_worker"

      for k in "${(@)names}"; do
        store_to_login_keychain "$keychain_platform" "$k" "${values[$k]}"
      done

      # Restore
      account="$old_account"
      repo="$old_repo"
      worker="$old_worker"

      total_uploaded=$((total_uploaded + ${#names[@]}))
      echo -e "${GREEN}[OK]${NC} Row $local_line_idx: uploaded ${#names[@]} secrets to $platform"
    else
      total_failed=$((total_failed + ${#names[@]}))
      echo -e "${RED}Row $local_line_idx: upload failed, secrets NOT stored in keychain${NC}"
    fi

    # Restore saved values for next iteration
    worker="$saved_worker"
    repo="$saved_repo"

  done < "$secrets_csv"

  vlog_section "CSV Mode Summary"
  vlog "Total rows processed: $local_line_idx"

  if [[ $verify_mode -eq 1 ]]; then
    echo ""
    echo "VERIFICATION SUMMARY"
    echo "  Secrets verified:  $total_verified"
    echo "  Secrets missing:   $total_missing"

    if [[ $total_missing -eq 0 ]]; then
      echo -e "${GREEN}[OK] ALL SECRETS VERIFIED SUCCESSFULLY${NC}"
      exit 0
    else
      echo -e "${RED}[FAIL] VERIFICATION COMPLETE: $total_missing secret(s) missing${NC}" >&2
      exit 1
    fi
  fi

  vlog "Total secrets uploaded: $total_uploaded"
  vlog "Total secrets failed:  $total_failed"

  if (( ${#err_lines[@]} > 0 )); then
    echo ""
    echo -e "${RED}UPLOAD ERRORS:${NC}"
    for e in "${(@)err_lines}"; do
      echo "- $e"
    done
    exit 1
  fi

  echo -e "${GREEN}[OK]${NC} Upload complete. $total_uploaded secrets uploaded across $local_line_idx rows."
  exit 0
fi

# ---------- non-CSV mode ----------
[[ -z "$platform" ]] && die "error" "Missing value for --platform/-p"

case "$platform" in
  cloudflare|github|gitlab|netlify) ;;
  *) die "error" "Unsupported platform: $platform" ;;
esac

[[ -z "${secrets_arg}" ]] && die "error" "Missing value for --keys/-k"

# worker required only for cloudflare
[[ "$platform" == "cloudflare" && -z "$worker" ]] && die "error" "Missing --worker for cloudflare"

# Parse comma-separated secret names
typeset -a rawnames
rawnames=("${(@f)$(split_names_csv_list "$secrets_arg")}")

# Normalize + de-dupe
typeset -A seen
typeset -a names
for raw in "${(@)rawnames}"; do
  up="$(to_upper_snake "$raw")"
  [[ -n "$up" ]] || continue
  if [[ -z "${seen[$up]:-}" ]]; then
    names+=("$up")
    seen[$up]=1
  fi
done

if (( ${#names[@]} == 0 )); then
  echo "No secret names provided." >&2
  exit 1
fi

guardrails_common "${names[@]}"

vlog "Parsed secret names: ${names[*]}"

# ---------- VERIFY MODE (non-CSV) ----------
if [[ $verify_mode -eq 1 ]]; then
  vlog_section "Verify Mode"
  vlog "Platform: $platform"
  vlog "Names: ${names[*]}"

  ensure_auth "$platform"

  verify_passed=0
  verify_failed=0

  for k in "${(@)names}"; do
    if verify_single_secret "$platform" "$k"; then
      verify_passed=$((verify_passed + 1))
    else
      verify_failed=$((verify_failed + 1))
    fi
  done

  echo ""
  echo "VERIFICATION SUMMARY"
  echo "  Secrets verified:  $verify_passed"
  echo "  Secrets missing:   $verify_failed"

  if [[ $verify_failed -eq 0 ]]; then
    echo -e "${GREEN}[OK] ALL SECRETS VERIFIED SUCCESSFULLY${NC}"
    exit 0
  else
    echo -e "${RED}[FAIL] VERIFICATION COMPLETE: $verify_failed secret(s) missing${NC}" >&2
    exit 1
  fi
fi

# ---------- CREATE MODE (non-CSV) ----------
# Generate values
typeset -A values
for k in "${(@)names}"; do
  values[$k]="$(gen_value)"
done

vlog "Generated ${#names[@]} secret values"

ensure_auth "$platform"

upload_ok=0
case "$platform" in
  cloudflare)
    if run_cmd_capture_err "cloudflare::bulk" upload_cloudflare; then
      upload_ok=1
    fi
    ;;
  github)
    if run_cmd_capture_err "github::secret-set" upload_github; then
      upload_ok=1
    fi
    ;;
  gitlab)
    if run_cmd_capture_err "gitlab::TODO" upload_gitlab; then
      upload_ok=1
    fi
    ;;
  netlify)
    if run_cmd_capture_err "netlify::TODO" upload_netlify; then
      upload_ok=1
    fi
    ;;
esac

# Store to keychain only on successful upload
if [[ $upload_ok -eq 1 ]]; then
  vlog "Storing ${#names[@]} secrets to keychain..."
  for k in "${(@)names}"; do
    store_to_login_keychain "$platform" "$k" "${values[$k]}"
  done
fi

if (( ${#err_lines[@]} > 0 )); then
  echo ""
  echo -e "${RED}UPLOAD ERRORS:${NC}"
  for e in "${(@)err_lines}"; do
    echo "- $e"
  done
  exit 1
fi

echo -e "${GREEN}[OK]${NC} Upload complete. ${#names[@]} secrets uploaded to $platform."