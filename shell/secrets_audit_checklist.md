# secrets.zsh Security and Operational Audit Checklist

**Version:** 1.0  
**Last Updated:** 2026-07-13  
**Maintainer:** Kent Schaeffer  
**Purpose:** Pre-deployment security review for secret management automation

---

## Executive Summary

| Category | Status | Items Checked | Issues Found |
|----------|--------|---------------|--------------|
| Input Validation | ☐ | 0/0 | 0 |
| Authentication Flow | ☐ | 0/0 | 0 |
| Keychain Security | ☐ | 0/0 | 0 |
| Platform Adapters | ☐ | 0/0 | 0 |
| Error Handling | ☐ | 0/0 | 0 |
| Code Quality | ☐ | 0/0 | 0 |
| Documentation | ☐ | 0/0 | 0 |

**Overall Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

## Section 1: Input Validation

### 1.1 Command-Line Argument Sanitization
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 1.1.1 | All arguments validated before use | ☐ | |
| 1.1.2 | Platform enum validation implemented | ☐ | cloudflare/github/gitlab/netlify |
| 1.1.3 | Secret names validated against UPPER_SNAKE_CASE regex | ☐ | `^[A-Z][A-Z0-9_]*$` |
| 1.1.4 | Secret name length limited (≤128 chars) | ☐ | |
| 1.1.5 | Special characters blocked in secret names | ☐ | No spaces, dashes, dots |
| 1.1.6 | Worker/repo parameters validated for required contexts | ☐ | Cloudflare=worker, GitHub=repo |

### 1.2 CSV Parsing Security
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 1.2.1 | CSV file existence verified before parsing | ☐ | |
| 1.2.2 | Blank lines properly skipped | ☐ | |
| 1.2.3 | Column count validated per row | ☐ | Minimum 3 columns (platform,repo,worker) |
| 1.2.4 | No RFC4180 quoted-field vulnerabilities | ☐ | Naive CSV parsing acknowledged |
| 1.2.5 | Row-level error isolation implemented | ☐ | One failed row doesn't stop entire batch |
| 1.2.6 | Cross-row variable contamination prevented | ☐ | saved_worker/saved_repo pattern |

---

## Section 2: Authentication Flow

### 2.1 Platform CLI Verification
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 2.1.1 | Cloudflare: `npx` availability checked | ☐ | |
| 2.1.2 | Cloudflare: `wrangler whoami` auth verification | ☐ | Uses `--json` flag |
| 2.1.3 | GitHub: `gh` CLI availability checked | ☐ | |
| 2.1.4 | GitHub: `gh auth status` verification | ☐ | |
| 2.1.5 | GitLab: `glab` CLI availability checked | ☐ | TODO: Implement |
| 2.1.6 | GitLab: `glab auth status` verification | ☐ | TODO: Implement |
| 2.1.7 | Netlify: netlify CLI availability checked | ☐ | |
| 2.1.8 | Netlify: `netlify status` verification | ☐ | |

### 2.2 Auth Failure Handling
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 2.2.1 | Clear error messages with remediation commands | ☐ | e.g., "Run: npx wrangler login" |
| 2.2.2 | Script exits gracefully on auth failure | ☐ | exit 1 with helpful message |
| 2.2.3 | No partial uploads on auth failure | ☐ | |

---

## Section 3: Keychain Security

### 3.1 Storage Configuration
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 3.1.1 | macOS Login Keychain used (not System) | ☐ | Default security behavior |
| 3.1.2 | Service names include all identifiers | ☐ | `secrets:p:account:repo:worker:key` |
| 3.1.3 | Account field populated consistently | ☐ | Defaults to USER or "default" |
| 3.1.4 | Label/Comment fields populated with metadata | ☐ | platform,repo,account,worker info |
| 3.1.5 | `-U` flag prevents duplicate entries | ☐ | Updates existing items |
| 3.1.6 | Value stored with `-w` (password) flag | ☐ | Raw value, not escaped |

### 3.2 Retrieval Security
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 3.2.1 | `--show-secret` requires all lookup components | ☐ | platform + (worker OR repo) |
| 3.2.2 | Secret names normalized before lookup | ☐ | to_upper_snake applied |
| 3.2.3 | Invalid secret names rejected before lookup | ☐ | validate_secret_name called |
| 3.2.4 | No plaintext secret logging | ☐ | Values redacted in output |

### 3.3 Keychain Access Control
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 3.3.1 | Consider adding `-T` access restriction flag | ☐ | Optional: prompts on access |
| 3.3.2 | Document keychain access permissions for users | ☐ | External documentation |
| 3.3.3 | Plan for keychain migration/backup | ☐ | Export/import procedures |

---

## Section 4: Platform Adapters

### 4.1 Cloudflare Worker Adapter
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 4.1.1 | `wrangler secret bulk` command validated | ☐ | Uses `/dev/stdin` piping |
| 4.1.2 | JSON payload properly constructed | ☐ | build_json_map function |
| 4.1.3 | Worker name required before upload | ☐ | Validated upfront |
| 4.1.4 | Confirmation prompt before upload | ☐ | User must answer y/Y |
| 4.1.5 | Bulk operation atomicity considered | ☐ | Single command, all-or-nothing |

### 4.2 GitHub Secrets Adapter
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 4.2.1 | `gh secret set` command validated | ☐ | Uses `--body` flag |
| 4.2.2 | Repository scope handled correctly | ☐ | `-R` flag when provided |
| 4.2.3 | CWD inference works when repo not specified | ☐ | Falls back to gh default |
| 4.2.4 | Per-secret upload (not bulk) | ☐ | Loop over names |
| 4.2.5 | Confirmation prompt before upload | ☐ | User must answer y/Y |

### 4.3 Pending Adapters
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 4.3.1 | GitLab CI/CD Variable API documented | ☐ | TODO: Research |
| 4.3.2 | GitLab CLI (`glab`) secret set available | ☐ | TODO: Research |
| 4.3.3 | Netlify Environment Variables API documented | ☐ | TODO: Research |
| 4.3.4 | Netlify CLI secret set available | ☐ | TODO: Research |

---

## Section 5: Error Handling

### 5.1 Error Collection
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 5.1.1 | `err_lines` array initialized early | ☐ | Before any operations |
| 5.1.2 | Individual operations capture errors | ☐ | run_cmd_capture_err wrapper |
| 5.1.3 | Error messages include operation label | ☐ | e.g., "cloudflare::bulk" |
| 5.1.4 | All errors collected before exit | ☐ | Printed at end of execution |
| 5.1.5 | Exit code reflects error presence | ☐ | exit 1 if any errors |

### 5.2 Partial Failure Scenarios
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 5.2.1 | CSV mode: Failed rows logged but don't stop batch | ☐ | row_failed flag |
| 5.2.2 | CSV mode: Successful rows still processed | ☐ | Continue loop on failure |
| 5.2.3 | Keychain storage conditional on upload success | ☐ | Only stores if no errors |
| 5.2.4 | Error output distinguishes which row failed | ☐ | Line index in error message |

---

## Section 6: Code Quality

### 6.1 Shell Safety
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 6.1.1 | `set -euo pipefail` enabled | ☐ | Fail fast behavior |
| 6.1.2 | No `local` keywords outside functions | ☐ | Fixed in setup block |
| 6.1.3 | Arrays declared with `typeset -a` | ☐ | Explicit typing |
| 6.1.4 | Associative arrays with `typeset -A` | ☐ | For seen/values maps |
| 6.1.5 | Tilde expansion handled properly | ☐ | Use `$HOME` instead of `~` |

### 6.2 Variable Scoping
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 6.2.1 | Global variables documented | ☐ | Top of script section |
| 6.2.2 | CSV loop variables isolated per row | ☐ | saved_worker/saved_repo |
| 6.2.3 | No unintended variable mutation | ☐ | Review for side effects |

### 6.3 Code Organization
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 6.3.1 | Functions grouped by concern | ☐ | Upload adapters separate |
| 6.3.2 | Comments explain non-obvious logic | ☐ | Keychain naming conventions |
| 6.3.3 | TODO markers identified for future work | ☐ | GitLab/Netlify adapters |
| 6.3.4 | Consistent indentation and formatting | ☐ | 2-space tabs |

---

## Section 7: Documentation

### 7.1 Usage Documentation
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 7.1.1 | `--help` output comprehensive | ☐ | Covers all modes |
| 7.1.2 | Examples cover common use cases | ☐ | Setup, single upload, CSV |
| 7.1.3 | CSV format specification clear | ☐ | Headers note, column order |
| 7.1.4 | Error messages actionable | ☐ | Include remediation steps |

### 7.2 Operational Documentation
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 7.2.1 | Prerequisites documented | ☐ | npx, gh, glab, netlify CLIs |
| 7.2.2 | Installation/setup documented | ☐ | Symlink creation |
| 7.2.3 | Keychain location documented | ☐ | macOS Login Keychain |
| 7.2.4 | Troubleshooting guide available | ☐ | Common failure modes |

---

## Section 8: Threat Modeling

### 8.1 Data Exposure Risks
| ID | Risk | Mitigation | Status |
|----|------|------------|--------|
| 8.1.1 | Secrets in shell history | Recommend `set +H` or custom prompt | ☐ |
| 8.1.2 | Secrets in process list | Values passed via stdin, not args | ☐ |
| 8.1.3 | Secrets in error logs | Redaction applied to output | ☐ |
| 8.1.4 | Keychain accessible to other users | macOS user isolation | ☐ |
| 8.1.5 | Temporary files with secrets | No temp files created | ☐ |

### 8.2 Injection Vulnerabilities
| ID | Risk | Mitigation | Status |
|----|------|------------|--------|
| 8.2.1 | Command injection via secret names | Regex validation blocks special chars | ☐ |
| 8.2.2 | JSON injection via secret values | json_escape applied before bulk | ☐ |
| 8.2.3 | Shell injection in CSV parsing | Comma split, no eval | ☐ |

### 8.3 Integrity Concerns
| ID | Risk | Mitigation | Status |
|----|------|------------|--------|
| 8.3.1 | Unauthorized script modification | Version control integrity checks | ☐ |
| 8.3.2 | Keychain entry tampering | User-level protection | ☐ |
| 8.3.3 | Platform API credential theft | Auth via official CLIs only | ☐ |

---

## Section 9: Compliance Checklist

### 9.1 Your Service Exclusion Policy
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 9.1.1 | No Google services referenced | ☐ | Verified |
| 9.1.2 | No Amazon/AWS services referenced | ☐ | Verified |
| 9.1.3 | No Meta/Facebook services referenced | ☐ | Verified |
| 9.1.4 | Privacy-focused alternatives prioritized | ☐ | Proton, Cloudflare |

### 9.2 Audit Trail Requirements
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| 9.2.1 | Secret creation timestamp tracked | ☐ | Via keychain modification date |
| 9.2.2 | Platform/repo/worker linkage maintained | ☐ | In keychain service name |
| 9.2.3 | Upload confirmation recorded | ☐ | Console output (consider logging) |
| 9.2.4 | Error events logged with details | ☐ | err_lines array |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | ____________________ | ___________ | _________ |
| Security Reviewer | ____________________ | ___________ | _________ |
| Approver | ____________________ | ___________ | _________ |

### Final Determination
☐ **APPROVED** - Ready for deployment  
☐ **CONDITIONAL APPROVAL** - Address noted issues before deployment  
☐ **DENIED** - Significant issues must be resolved

---

## Notes Section

Use this space for auditor observations, findings, or recommendations: