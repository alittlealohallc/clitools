#!/usr/bin/env python3
"""
naming-validator.py — Phase 1 Naming Convention Validator for mvrepo

Validates repository names against naming conventions before any git operations.
Scans existing repos, detects collisions, and suggests corrections.

Usage:
  python3 naming-validator.py -n new-name [-o org] [-d dry-run]
  python3 naming-validator.py -f repos.csv [-d dry-run]
  python3 naming-validator.py --show-repos [--filter prefaceId]

Exit Codes:
  0: Success (name valid, no collisions)
  1: Validation failed (name violates rules)
  2: Collision detected (name exists, case-insensitive)
  3: CSV batch error (one or more rows failed)
  4: Fatal error (missing config, unreadable dirs)
"""

import json
import os
import sys
import re
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import logging

# ANSI colors
class Color:
    GREEN = '\033[0;32m'
    RED = '\033[0;31m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

# Logger setup
def setup_logger(log_file: Path) -> logging.Logger:
    """Configure file and console logging."""
    logger = logging.getLogger('naming_validator')
    logger.setLevel(logging.DEBUG)
    
    # Console handler (INFO and above)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_fmt = logging.Formatter(
        '[%(levelname)s] %(message)s'
    )
    console_handler.setFormatter(console_fmt)
    
    # File handler (DEBUG and above)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_file, mode='a')
    file_handler.setLevel(logging.DEBUG)
    file_fmt = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_fmt)
    
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    return logger

class NamingValidator:
    """Validates repository names against naming conventions."""
    
    def __init__(self, rules_file: Path, log_file: Path):
        self.logger = setup_logger(log_file)
        self.rules = self._load_rules(rules_file)
        self.repo_index = {}  # { lowercase-name: { name, folder, remotes } }
        self._build_repo_index()
    
    def _load_rules(self, rules_file: Path) -> dict:
        """Load naming rules from JSON config."""
        try:
            with open(rules_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            self.logger.error(f"Rules file not found: {rules_file}")
            sys.exit(4)
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in rules file: {e}")
            sys.exit(4)
    
    def _build_repo_index(self) -> None:
        """Scan ~/git, ~/git/github, ~/git/gitlab and build index of existing repos."""
        self.logger.info("Building repository index...")
        
        base_dirs = [
            Path(d).expanduser() for d in self.rules.get('baseDirs', [])
        ]
        
        for base_dir in base_dirs:
            if not base_dir.exists():
                self.logger.debug(f"Base dir does not exist (skipping): {base_dir}")
                continue
            
            for folder in base_dir.iterdir():
                if not folder.is_dir() or folder.name.startswith('.'):
                    continue
                
                folder_name = folder.name
                folder_lower = folder_name.lower()
                
                # Try to get remote URL
                remotes = self._get_remotes(folder)
                
                self.repo_index[folder_lower] = {
                    'name': folder_name,  # Preserve case
                    'folder': str(folder),
                    'remotes': remotes
                }
                self.logger.debug(f"Indexed: {folder_lower} ({folder_name}) at {folder}")
        
        self.logger.info(f"Repository index built: {len(self.repo_index)} repos found")
    
    def _get_remotes(self, folder: Path) -> List[str]:
        """Extract remote URLs from a git repository."""
        try:
            result = subprocess.run(
                ['git', 'remote', '-v'],
                cwd=folder,
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode != 0:
                return []
            
            remotes = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    parts = line.split()
                    if len(parts) >= 2:
                        remotes.append(parts[1])
            return remotes
        except Exception as e:
            self.logger.debug(f"Failed to get remotes for {folder}: {e}")
            return []
    
    def _sanitize_name(self, name: str) -> str:
        """Remove special characters (including hyphens) and lowercase."""
        # Remove all special chars except alphanumeric
        sanitized = re.sub(r'[^a-zA-Z0-9]+', '', name).lower()
        return sanitized
    
    def _parse_name(self, name: str) -> Tuple[bool, List[str], Optional[str]]:
        """Parse name into segments. Returns (valid, segments, error_msg)."""
        # Sanitize: remove special chars, lowercase
        sanitized = self._sanitize_name(name)
        
        if not sanitized:
            return False, [], "Name contains no valid characters"
        
        # Split on word boundaries (we'll reconstruct with hyphens)
        # For now, assume user passes segments separated by hyphens
        # After sanitization, we need to re-apply hyphens intelligently
        # For Phase 1, we'll expect user to pass properly formatted names
        # and just validate the structure
        
        # Re-split by hyphens (user's input format)
        segments = name.lower().split('-')
        segments = [s for s in segments if s]  # Remove empty
        
        if len(segments) < 3:
            return False, segments, f"Name must have 3-4 segments, got {len(segments)}"
        
        if len(segments) > 4:
            return False, segments, f"Name must have 3-4 segments, got {len(segments)}"
        
        return True, segments, None
    
    def _validate_segments(self, segments: List[str]) -> Tuple[bool, Optional[str]]:
        """Validate each segment against rules."""
        if not segments or len(segments) < 3:
            return False, "Invalid segment count"
        
        # Segment 0: prefaceId
        preface = segments[0]
        valid_prefaces = self.rules.get('prefaceIds', [])
        if preface not in valid_prefaces:
            return False, f"prefaceId '{preface}' not in allowed list: {valid_prefaces}"
        
        segment_rules = self.rules.get('segments', {})
        
        # Validate clientId (segment 1)
        client = segments[1]
        client_rule = segment_rules.get('clientId', {})
        if not (client_rule.get('minLen', 0) <= len(client) <= client_rule.get('maxLen', 255)):
            return False, f"clientId '{client}' length must be {client_rule.get('minLen')}-{client_rule.get('maxLen')} chars"
        if not re.match(client_rule.get('pattern', '^.*$'), client):
            return False, f"clientId '{client}' contains invalid characters"
        
        # Validate appId (segment 2)
        app = segments[2]
        app_rule = segment_rules.get('appId', {})
        if not (app_rule.get('minLen', 0) <= len(app) <= app_rule.get('maxLen', 255)):
            return False, f"appId '{app}' length must be {app_rule.get('minLen')}-{app_rule.get('maxLen')} chars"
        if not re.match(app_rule.get('pattern', '^.*$'), app):
            return False, f"appId '{app}' contains invalid characters"
        
        # Validate projectId (segment 3, optional)
        if len(segments) == 4:
            project = segments[3]
            project_rule = segment_rules.get('projectId', {})
            if not (project_rule.get('minLen', 0) <= len(project) <= project_rule.get('maxLen', 255)):
                return False, f"projectId '{project}' length must be {project_rule.get('minLen')}-{project_rule.get('maxLen')} chars"
            if not re.match(project_rule.get('pattern', '^.*$'), project):
                return False, f"projectId '{project}' contains invalid characters"
        
        return True, None
    
    def _check_total_length(self, name: str) -> Tuple[bool, Optional[str]]:
        """Check total name length."""
        max_len = self.rules.get('totalMaxLen', 100)
        if len(name) > max_len:
            return False, f"Total name length {len(name)} exceeds max {max_len}"
        return True, None
    
    def _reconstruct_name(self, segments: List[str]) -> str:
        """Reconstruct name from segments with hyphens."""
        return '-'.join(segments)
    
    def _check_collision(self, name: str) -> Tuple[bool, Optional[Dict]]:
        """Check if name (case-insensitive) already exists. Returns (no_collision, collision_info)."""
        name_lower = name.lower()
        
        if name_lower in self.repo_index:
            collision = self.repo_index[name_lower]
            return False, collision
        
        return True, None
    
    def _generate_suggestions(self, base_segments: List[str]) -> List[str]:
        """Generate 3 suggestions by tweaking segments."""
        suggestions = []
        
        # Suggestion 1: Add -v2 (projectId variant)
        if len(base_segments) == 3:
            suggestions.append('-'.join(base_segments + ['v2']))
        elif len(base_segments) == 4:
            # Replace projectId with v2
            suggestions.append('-'.join(base_segments[:3] + ['v2']))
        
        # Suggestion 2: Add -v3
        if len(base_segments) == 3:
            suggestions.append('-'.join(base_segments + ['v3']))
        elif len(base_segments) == 4:
            suggestions.append('-'.join(base_segments[:3] + ['v3']))
        
        # Suggestion 3: Shorten appId if possible
        if len(base_segments[2]) > 5:
            shortened = base_segments[:2] + [base_segments[2][:5]]
            suggestions.append('-'.join(shortened))
        else:
            suggestions.append('-'.join(base_segments + ['alt']))
        
        return suggestions[:3]
    
    def validate(self, new_name: str, old_name: Optional[str] = None) -> Tuple[int, str]:
        """
        Validate a name. Returns (exit_code, message).
        
        Exit codes:
          0: Valid, no collisions
          1: Validation failed
          2: Collision detected
        """
        self.logger.info(f"Validating new_name='{new_name}', old_name='{old_name}'")
        
        # Parse segments
        valid, segments, error = self._parse_name(new_name)
        if not valid:
            msg = f"{Color.RED}✗ Parse error: {error}{Color.RESET}"
            self.logger.error(msg)
            return 1, msg
        
        self.logger.debug(f"Segments: {segments}")
        
        # Validate each segment
        valid, error = self._validate_segments(segments)
        if not valid:
            msg = f"{Color.RED}✗ Validation error: {error}{Color.RESET}"
            self.logger.error(msg)
            return 1, msg
        
        # Reconstruct canonical name
        canonical_name = self._reconstruct_name(segments)
        self.logger.debug(f"Canonical name: {canonical_name}")
        
        # Check total length
        valid, error = self._check_total_length(canonical_name)
        if not valid:
            msg = f"{Color.RED}✗ Length error: {error}{Color.RESET}"
            self.logger.error(msg)
            return 1, msg
        
        # Check for collisions
        no_collision, collision = self._check_collision(canonical_name)
        if not no_collision:
            # Collision detected
            msg = (
                f"{Color.RED}✗ Collision detected!{Color.RESET}\n"
                f"  Existing name (case): {collision['name']}\n"
                f"  Folder: {collision['folder']}\n"
                f"  Remotes: {collision['remotes']}\n\n"
            )
            
            # Check if old_name matches collision (case-insensitive)
            if old_name and old_name.lower() == canonical_name:
                msg += (
                    f"{Color.YELLOW}⚠ The new name matches an existing folder/repo.{Color.RESET}\n"
                    f"  Existing case: {collision['name']}\n"
                    f"  New name (lowercase): {canonical_name}\n\n"
                    f"{Color.CYAN}Suggestions:{Color.RESET}\n"
                    f"  1. Use lowercase version: {canonical_name}\n"
                )
                suggestions = self._generate_suggestions(segments)
                for i, suggestion in enumerate(suggestions, start=2):
                    msg += f"  {i}. Add variant: {suggestion}\n"
                msg += (
                    f"\n{Color.CYAN}Options:{Color.RESET}\n"
                    f"  - Accept lowercase (y)\n"
                    f"  - Choose suggestion (1-{len(suggestions)+1})\n"
                    f"  - Enter custom name (c)\n"
                    f"  - Show existing repos (s)\n"
                    f"  - Exit (n)\n"
                )
            else:
                msg += f"{Color.CYAN}Suggestions:{Color.RESET}\n"
                suggestions = self._generate_suggestions(segments)
                for i, suggestion in enumerate(suggestions, start=1):
                    msg += f"  {i}. {suggestion}\n"
                msg += (
                    f"\n{Color.CYAN}Options:{Color.RESET}\n"
                    f"  - Choose suggestion (1-{len(suggestions)})\n"
                    f"  - Enter custom name (c)\n"
                    f"  - Show existing repos (s)\n"
                    f"  - Exit (n)\n"
                )
            
            self.logger.warning(msg)
            return 2, msg
        
        # Success
        msg = f"{Color.GREEN}✓ Name valid: {canonical_name}{Color.RESET}"
        self.logger.info(msg)
        return 0, msg
    
    def show_repos(self, filter_preface: Optional[str] = None) -> None:
        """Display all indexed repositories in table format."""
        print(f"\n{Color.BOLD}Indexed Repositories:{Color.RESET}\n")
        
        if not self.repo_index:
            print("No repositories found.")
            return
        
        # Header
        print(f"{'Folder Name':<30} {'Path':<50} {'Remotes':<40}")
        print("-" * 120)
        
        for lower_name in sorted(self.repo_index.keys()):
            repo = self.repo_index[lower_name]
            name = repo['name']
            folder = repo['folder']
            remotes = ', '.join(repo['remotes'][:2]) if repo['remotes'] else '(none)'
            
            print(f"{name:<30} {folder:<50} {remotes:<40}")
        
        print()

def main():
    parser = argparse.ArgumentParser(
        description='Validate repository names against naming conventions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument('-n', '--name', type=str, help='New repository name to validate')
    parser.add_argument('-o', '--org', type=str, default='aloha', help='Organization/user name (default: aloha)')
    parser.add_argument('-f', '--file', type=str, help='CSV file with repos to validate')
    parser.add_argument('--show-repos', action='store_true', help='Show all indexed repositories')
    parser.add_argument('--filter', type=str, help='Filter repos by prefaceId')
    parser.add_argument('-d', '--dry-run', action='store_true', help='Dry-run mode (no changes)')
    
    args = parser.parse_args()
    
    # Setup
    script_dir = Path(__file__).parent
    rules_file = script_dir / 'naming-rules.json'
    log_dir = Path.home() / '.mvrepo'
    log_file = log_dir / f'validator-{datetime.now().strftime("%Y-%m-%d")}.log'
    
    validator = NamingValidator(rules_file, log_file)
    
    # Handle --show-repos
    if args.show_repos:
        validator.show_repos(filter_preface=args.filter)
        return 0
    
    # Handle single name validation
    if args.name:
        exit_code, message = validator.validate(args.name)
        print(message)
        return exit_code
    
    # Handle CSV file
    if args.file:
        csv_path = Path(args.file)
        if not csv_path.exists():
            print(f"{Color.RED}✗ CSV file not found: {csv_path}{Color.RESET}")
            return 4
        
        print(f"{Color.CYAN}Processing CSV: {csv_path}{Color.RESET}\n")
        
        failed_rows = []
        success_count = 0
        
        with open(csv_path, 'r') as f:
            lines = f.readlines()
        
        # Parse header
        if not lines:
            print(f"{Color.RED}✗ CSV file is empty{Color.RESET}")
            return 4
        
        header = lines[0].strip().split(',')
        validator.logger.info(f"CSV header: {header}")
        
        for line_num, line in enumerate(lines[1:], start=2):
            line = line.strip()
            if not line:
                continue
            
            parts = [p.strip() for p in line.split(',')]
            old_name = parts[0] if len(parts) > 0 else None
            new_name = parts[1] if len(parts) > 1 else None
            
            if not new_name:
                print(f"{Color.YELLOW}⚠ Line {line_num}: Missing new_name, skipping{Color.RESET}")
                failed_rows.append((line_num, "Missing new_name"))
                continue
            
            print(f"{Color.CYAN}Line {line_num}: {old_name} → {new_name}{Color.RESET}")
            exit_code, message = validator.validate(new_name, old_name)
            
            if exit_code != 0:
                failed_rows.append((line_num, message))
                print(f"  {message}\n")
            else:
                success_count += 1
                print(f"  {message}\n")
        
        # Summary
        total = len(lines) - 1
        print(f"\n{Color.CYAN}{'='*60}{Color.RESET}")
        print(f"CSV Processing Summary:")
        print(f"  Total rows: {total}")
        print(f"  Success: {success_count}")
        print(f"  Failed: {len(failed_rows)}")
        
        if failed_rows:
            print(f"\n{Color.RED}Failed rows:{Color.RESET}")
            for line_num, error in failed_rows:
                print(f"  Line {line_num}: {error}")
            return 3
        
        return 0
    
    parser.print_help()
    return 0

if __name__ == '__main__':
    sys.exit(main())
