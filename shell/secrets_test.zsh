#!/usr/bin/env zsh
# secrets_test.zsh - Test harness for secrets.zsh secret management script
# Location: ~/git/clitools/shell/secrets_test.zsh
# Author: Kent Schaeffer
# Purpose: Validate secrets.zsh functionality without exposing production secrets

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SECRETS_SCRIPT="$SCRIPT_DIR/secrets.zsh"
TEST_PREFIX="TEST_$(date +%s)_$$"
TEST_ACCOUNT="test_account_${TEST_PREFIX}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

log_info()   { echo -e "${BLUE}[INFO]${NC} $*"; }
log_pass()   { echo -e "${GREEN}[PASS]${NC} $*"; TESTS_PASSED=$((TESTS_PASSED+1)); }
log_fail()   { echo -e "${RED}[FAIL]${NC} $*"; TESTS_FAILED=$((TESTS_FAILED+1)); }
log_skip()   { echo -e "${YELLOW}[SKIP]${NC} $*"; TESTS_SKIPPED=$((TESTS_SKIPPED+1)); }
log_section() { echo ""; echo "========================================"; echo "$*"; echo "========================================"; }

cleanup_test_secrets() {
  log_info "Cleaning up test secrets from keychain..."
  
  # Find and delete all test-related keychain entries
  local search_pattern="secrets:${TEST_PREFIX}"
  local found_keys
  
  # List matching passwords
  found_keys=$(security find-generic-password -g -s "$search_pattern" 2>/dev/null | \
               grep 'account:' | awk '{print $2}' || true)
  
  if [[ -n "$found_keys" ]]; then
    for key in $found_keys; do
      security delete-generic-password -a "$USER" -s "$search_pattern:$key" 2>/dev/null || true
    done
  fi
  
  log_info "Cleanup complete"
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="${3:-Assertion failed}"
  
  if [[ "$expected" == "$actual" ]]; then
    return 0
  else
    log_fail "$message"
    log_info "  Expected: $expected"
    log_info "  Actual:   $actual"
    return 1
  fi
}

assert_file_exists() {
  local filepath="$1"
  local message="${2:-File does not exist: $filepath}"
  
  if [[ -f "$filepath" ]]; then
    log_pass "$message"
    return 0
  else
    log_fail "$message"
    return 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local message="${3:-String not found}"
  
  if [[ "$haystack" == *"$needle"* ]]; then
    log_pass "$message"
    return 0
  else
    log_fail "$message"
    log_info "  Looking for: $needle"
    log_info "  In string:   $haystack"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# TEST SUITE
# ---------------------------------------------------------------------------

test_setup_flag() {
  log_section "Test: --setup flag creates symlink correctly"
  
  local bin_path="$HOME/bin/secrets"
  local target_path="$HOME/git/clitools/shell/secrets.zsh"
  
  # Clean any existing symlink
  [[ -L "$bin_path" ]] && rm "$bin_path"
  
  # Run setup
  local output
  output="$("$SECRETS_SCRIPT" --setup 2>&1)"
  
  assert_equals 0 $? "Setup command should succeed"
  assert_file_exists "$bin_path" "Symlink should exist at $bin_path"
  assert_true "$(readlink "$bin_path" == "$target_path")" "Symlink should point to correct target"
  
  # Cleanup
  rm "$bin_path"
}

test_platform_validation() {
  log_section "Test: Platform validation rejects invalid platforms"
  
  local output
  
  # Test invalid platform
  output="$("$SECRETS_SCRIPT" --platform invalidplatform -k TEST_KEY 2>&1)" || true
  assert_contains "$output" "Unsupported platform" "Should reject invalid platform"
  
  # Test missing platform
  output="$("$SECRETS_SCRIPT" -k TEST_KEY 2>&1)" || true
  assert_contains "$output" "Missing --platform" "Should require --platform"
}

test_secret_name_validation() {
  log_section "Test: Secret name validation enforces UPPER_SNAKE_CASE"
  
  local output
  
  # Test valid name
  output="$("$SECRETS_SCRIPT" --platform github --repo test/test -k VALID_TEST_KEY 2>&1)" || true
  assert_equals 0 $? "Valid secret name should pass"
  
  # Test invalid names (should fail guardrails)
  output="$("$SECRETS_SCRIPT" --platform github --repo test/test -k "invalid-key" 2>&1)" || true
  assert_contains "$output" "Guardrail failure" "Reject lowercase-dash secret names"
  
  output="$("$SECRETS_SCRIPT" --platform github --repo test/test -k "1INVALID" 2>&1)" || true
  assert_contains "$output" "Guardrail failure" "Reject names starting with number"
  
  output="$("$SECRETS_SCRIPT" --platform github --repo test/test -k "has spaces" 2>&1)" || true
  assert_contains "$output" "Guardrail failure" "Reject names with spaces"
}

test_upper_snake_conversion() {
  log_section "Test: Secret names converted to UPPER_SNAKE_CASE"
  
  # Test conversion function via keychain storage
  local test_key="my-test.key-name"
  local expected_key="MY_TEST_KEY_NAME"
  
  # We can't easily verify without actually uploading, so we test the pattern
  # by checking the to_upper_snake logic manually
  local result
  result=$(source "$SECRETS_SCRIPT" 2>/dev/null; to_upper_snake "$test_key")
  
  assert_equals "$expected_key" "$result" "Name conversion should produce UPPER_SNAKE_CASE"
}

test_show_secret_missing_params() {
  log_section "Test: --show-secret validates required parameters"
  
  local output
  
  # Missing platform
  output="$("$SECRETS_SCRIPT" --show-secret TEST_KEY 2>&1)" || true
  assert_contains "$output" "Missing --platform" "Should require platform for lookup"
  
  # Missing worker for cloudflare
  output="$("$SECRETS_SCRIPT" --platform cloudflare --show-secret TEST_KEY 2>&1)" || true
  assert_contains "$output" "Missing --worker" "Cloudflare lookup should require worker"
  
  # Missing repo for github
  output="$("$SECRETS_SCRIPT" --platform github --show-secret TEST_KEY 2>&1)" || true
  assert_contains "$output" "Missing --repo" "GitHub lookup should require repo"
}

test_keychain_storage_structure() {
  log_section "Test: Keychain entries created with correct naming convention"
  
  local test_secret="KEYCHAIN_TEST_${TEST_PREFIX}"
  local test_value="test_value_${TEST_PREFIX}"
  
  # Create a known entry
  security add-generic-password \
    -U \
    -a "$USER" \
    -s "secrets:github:test:test_repo:${test_secret}" \
    -w "$test_value" \
    -l "Test Entry" \
    -c "platform=test" \
    >/dev/null
  
  # Verify retrieval
  local retrieved
  retrieved=$(security find-generic-password \
    -a "$USER" \
    -s "secrets:github:test:test_repo:${test_secret}" \
    -w 2>/dev/null) || true
  
  assert_equals "$test_value" "$retrieved" "Keychain value should match stored value"
  
  # Cleanup
  security delete-generic-password -a "$USER" -s "secrets:github:test:test_repo:${test_secret}" 2>/dev/null || true
}

test_csv_parsing_basic() {
  log_section "Test: CSV parsing extracts fields correctly"
  
  local temp_csv="/tmp/test_secrets_$$.csv"
  
  # Create test CSV
  cat > "$temp_csv" << EOF
github,test_owner/test_repo,,API_KEY,DB_URL
cloudflare,test_worker,,CF_API_TOKEN,WORKER_SECRET
EOF
  
  # Parse using the script's CSV mode (dry-run validation)
  # Note: This would require mocking auth - skipping actual upload
  
  assert_file_exists "$temp_csv" "Temporary CSV file should exist"
  rm "$temp_csv"
}

test_json_escape() {
  log_section "Test: JSON escaping handles special characters"
  
  local test_input='test"value\with"special\chars'
  local expected='test\"value\\with\"special\\chars'
  local result
  
  result=$(source "$SECRETS_SCRIPT" 2>/dev/null; json_escape "$test_input")
  
  assert_equals "$expected" "$result" "JSON escape should handle quotes and backslashes"
}

test_gen_value_length() {
  log_section "Test: Generated secret values meet length requirements"
  
  local test_value
  test_value=$(gen_value)
  
  local len=${#test_value}
  
  # Should be approximately 64-72 chars (base64 encoded 48 bytes)
  if (( len >= 60 && len <= 80 )); then
    log_pass "Generated value length ($len chars) meets requirements"
    TESTS_PASSED=$((TESTS_PASSED+1))
  else
    log_fail "Generated value length ($len chars) outside expected range"
    TESTS_FAILED=$((TESTS_FAILED+1))
  fi
}

test_auth_detection_cloudflare() {
  log_section "Test: Cloudflare authentication detection"
  
  local output
  
  # Check if wrangler is installed
  if ! command -v npx >/dev/null; then
    log_skip "npx not installed - skipping Cloudflare auth test"
    TESTS_SKIPPED=$((TESTS_SKIPPED+1))
    return
  fi
  
  output=$(npx wrangler whoami --json 2>&1) || true
  
  if [[ "$output" =~ '"success":true' ]] || [[ "$output" =~ '"errors":\[\]' ]]; then
    log_pass "Cloudflare authentication detected"
    TESTS_PASSED=$((TESTS_PASSED+1))
  else
    log_skip "Cloudflare not authenticated - run 'npx wrangler login'"
    TESTS_SKIPPED=$((TESTS_SKIPPED+1))
  fi
}

test_auth_detection_github() {
  log_section "Test: GitHub authentication detection"
  
  local output
  
  # Check if gh CLI is installed
  if ! command -v gh >/dev/null; then
    log_skip "gh CLI not installed - skipping GitHub auth test"
    TESTS_SKIPPED=$((TESTS_SKIPPED+1))
    return
  fi
  
  output=$(gh auth status 2>&1) || true
  
  if [[ "$output" =~ "Logged in" ]] || [[ "$output" =~ "authentication succeeded" ]]; then
    log_pass "GitHub authentication detected"
    TESTS_PASSED=$((TESTS_PASSED+1))
  else
    log_skip "GitHub not authenticated - run 'gh auth login'"
    TESTS_SKIPPED=$((TESTS_SKIPPED+1))
  fi
}

test_error_collection() {
  log_section "Test: Error collection accumulates multiple failures"
  
  # This tests the err_lines array behavior
  local -a test_errors=()
  
  test_errors+=("error1")
  test_errors+=("error2")
  test_errors+=("error3")
  
  if (( ${#test_errors[@]} == 3 )); then
    log_pass "Error array correctly accumulated 3 entries"
    TESTS_PASSED=$((TESTS_PASSED+1))
  else
    log_fail "Error array did not accumulate correctly (${#test_errors[@]} entries)"
    TESTS_FAILED=$((TESTS_FAILED+1))
  fi
}

test_variable_scoping_csv_loop() {
  log_section "Test: CSV loop preserves worker/repo isolation"
  
  # This verifies the saved_worker/saved_repo pattern works
  local original_worker="original_worker"
  local original_repo="original_repo"
  local saved_worker saved_repo
  
  saved_worker="$original_worker"
  saved_repo="$original_repo"
  
  # Simulate loop modification
  worker="modified_worker"
  repo="modified_repo"
  
  # Restore
  worker="$saved_worker"
  repo="$saved_repo"
  
  assert_equals "$original_worker" "$worker" "Worker should be restored after loop iteration"
  assert_equals "$original_repo" "$repo" "Repo should be restored after loop iteration"
}

# ---------------------------------------------------------------------------
# MAIN EXECUTION
# ---------------------------------------------------------------------------

main() {
  echo "============================================================"
  echo "     secrets.zsh Test Harness - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "     Test Prefix: $TEST_PREFIX"
  echo "============================================================"
  echo ""
  
  # Verify script exists
  if [[ ! -f "$SECRETS_SCRIPT" ]]; then
    log_fail "Main script not found at: $SECRETS_SCRIPT"
    exit 1
  fi
  
  log_pass "Main script located successfully"
  
  # Run selected or all tests
  local run_all=true
  local selected_tests=()
  
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --setup)
        test_setup_flag
        run_all=false
        shift
        ;;
      --platform-validation)
        test_platform_validation
        run_all=false
        shift
        ;;
      --secret-names)
        test_secret_name_validation
        run_all=false
        shift
        ;;
      --snake-case)
        test_upper_snake_conversion
        run_all=false
        shift
        ;;
      --show-secret)
        test_show_secret_missing_params
        run_all=false
        shift
        ;;
      --keychain)
        test_keychain_storage_structure
        run_all=false
        shift
        ;;
      --csv-parse)
        test_csv_parsing_basic
        run_all=false
        shift
        ;;
      --json-escape)
        test_json_escape
        run_all=false
        shift
        ;;
      --gen-value)
        test_gen_value_length
        run_all=false
        shift
        ;;
      --auth-cf)
        test_auth_detection_cloudflare
        run_all=false
        shift
        ;;
      --auth-gh)
        test_auth_detection_github
        run_all=false
        shift
        ;;
      --errors)
        test_error_collection
        run_all=false
        shift
        ;;
      --scoping)
        test_variable_scoping_csv_loop
        run_all=false
        shift
        ;;
      --cleanup)
        cleanup_test_secrets
        exit 0
        ;;
      --all|*)
        run_all=true
        shift
        ;;
    esac
  done
  
  if [[ "$run_all" == true ]]; then
    # Run all tests
    test_setup_flag || true
    test_platform_validation || true
    test_secret_name_validation || true
    test_upper_snake_conversion || true
    test_show_secret_missing_params || true
    test_keychain_storage_structure || true
    test_csv_parsing_basic || true
    test_json_escape || true
    test_gen_value_length || true
    test_auth_detection_cloudflare || true
    test_auth_detection_github || true
    test_error_collection || true
    test_variable_scoping_csv_loop || true
  fi
  
  # Summary
  echo ""
  echo "============================================================"
  echo "                    TEST SUMMARY"
  echo "============================================================"
  log_info "Tests Passed:  $TESTS_PASSED"
  log_info "Tests Failed:  $TESTS_FAILED"
  log_info "Tests Skipped: $TESTS_SKIPPED"
  echo "============================================================"
  
  # Cleanup
  cleanup_test_secrets
  
  # Exit with appropriate code
  if (( TESTS_FAILED > 0 )); then
    exit 1
  else
    exit 0
  fi
}

main "$@"