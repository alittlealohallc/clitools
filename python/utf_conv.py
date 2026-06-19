#!/usr/bin/env python3
"""
utf-conv.py - Unicode text file converter and cleaner (v1.1.1)
Converts between encodings (UTF-8, UTF-16) and strips unwanted characters.
Fixed: -f / --force now correctly overwrites the original input file.
"""

import argparse
import os
import sys
import shutil
from pathlib import Path

VERSION = "1.1.1"

# Symbol replacement mappings for strict ASCII output
SYMBOL_REPLACEMENTS = {
    # Checkmarks / X marks
    '✅': '[OK]', '☑️': '[OK]', '☐': '[ ]', '☒': '[X]', '✓': '[OK]', '✔': '[OK]',
    '✗': '[X]', '✘': '[X]', '❌': '[X]', '❎': '[X]',
    # Arrows
    '→': '->', '←': '<-', '↑': '^', '↓': 'v', '⇒': '=>', '⇐': '<=',
    # Bullets / Lists
    '•': '*', '◦': '*', '▪': '*', '▸': '*', '▶': '>', '►': '>',
    # Quotes / Punctuation
    '«': '"', '»': '"', '“': '"', '”': '"', '‘': "'", '’': "'", '‚': "'",
    '–': '-', '—': '--', '…': '...', '·': '.',
    # Symbols
    '©': '(c)', '®': '(R)', '™': '(TM)', '€': '[EUR]', '£': '[GBP]', '¥': '[JPY]',
    '°': 'deg', '±': '+/-', '÷': '/', '×': '*',
    '§': 'SS', '¶': 'P',
    # Miscellaneous
    '🔹': '*', '🔸': '*', '🔶': '*', '🔷': '*',
    '📁': '[DIR]', '📄': '[FILE]', '📋': '[LIST]', '📊': '[DATA]',
    '🚫': '[NO]', '💡': '[NOTE]', '⚠': '[WARN]', '⚡': '[NOTE]',
    '∞': 'INF', '≈': '~', '≠': '!=', '≤': '<=', '≥': '>=',
    'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta',
    'Ω': 'Ohm', 'µ': 'u', 'π': 'pi',
}

USAGE = """
Usage: utf-conv.py [OPTIONS] <file> [<file> ...]

Unicode Text File Converter & Cleaner (v1.1.1)

Examples:
  %(prog)s document.txt                          # Clean, output same name + _converted suffix
  %(prog)s -t utf16 input.md output.txt          # Convert to UTF-16, explicit output path
  %(prog)s -c ascii -f *.txt                     # CRITICAL: Overwrite originals with clean ASCII
  %(prog)s -s                                    # Create symlink in ~/bin/

Options:
  -h, --help            Show this help message and exit
  -v, --version         Show version number and exit
  -s, --setup           Create executable symlink in ~/bin/ pointing to this script
  -t, --target-encoding TARGET
                        Output encoding: utf-8 (default), utf-16, utf-16-le, utf-16-be
  -f, --force           Overwrite original files in-place (no backup, no prompts). 
                        Requires no -o/--output-dir argument unless explicitly redirecting.
  -c, --clean MODE      Character cleaning mode: none (default), ascii, printable
                        * ascii: Only A-Z, a-z, 0-9, space, tab, newline, punctuation
                                 AND replaces known Unicode symbols with ASCII equivalents
                        * printable: Remove control chars and non-printable Unicode (lenient)
  -i, --input-dir DIR   Alternative input directory for source files
  -o, --output-dir DIR  Alternative output directory (overrides default behavior)
  --bom                 Include Byte Order Mark (BOM) in output (default: yes for UTF-16)
  --no-bom              Exclude BOM from output
  --dry-run             Preview changes without modifying files
  -r, --recursive       Recursively process files in directories (with wildcards)
  --verbose             Show detailed character replacement information
  --quiet               Suppress all output except errors
"""


def setup_symlink():
    """Create symlink in ~/bin/ pointing to this script."""
    home = Path.home()
    bin_dir = home / "bin"
    script_path = Path(__file__).resolve()
    
    bin_dir.mkdir(exist_ok=True)
    link_path = bin_dir / "utf-conv"
    
    if link_path.exists() or link_path.is_symlink():
        try:
            link_path.unlink()
        except Exception as e:
            print(f"Warning: Could not remove existing symlink: {e}", file=sys.stderr)
            return False
    
    try:
        link_path.symlink_to(script_path)
        print(f"Created symlink: {link_path}")
        print(f"This script is now available as 'utf-conv' in PATH")
        return True
    except Exception as e:
        print(f"Error creating symlink: {e}", file=sys.stderr)
        return False


def detect_encoding(filepath):
    """Attempt to detect file encoding by trying common formats."""
    encodings = ['utf-8-sig', 'utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1']
    
    for enc in encodings:
        try:
            with open(filepath, 'r', encoding=enc, errors='strict') as f:
                f.read(1024)
            return enc
        except (UnicodeDecodeError, LookupError, ValueError):
            continue
    
    return None


def clean_content(content, mode, verbose=False):
    """Strip unwanted characters based on cleaning mode."""
    if mode == 'none':
        return content, []
    
    elif mode == 'printable':
        result = []
        replaced = []
        for char in content:
            if char in '\n\t\r ':
                result.append(char)
            elif char.isprintable():
                result.append(char)
            else:
                replaced.append((char, ''))
        return ''.join(result), replaced
    
    elif mode == 'ascii':
        result = []
        replaced = []
        
        for char in content:
            if char in SYMBOL_REPLACEMENTS:
                replacement = SYMBOL_REPLACEMENTS[char]
                result.append(replacement)
                replaced.append((char, replacement))
            elif char.isascii() and (char.isalnum() or char in ' \t\n\r!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'):
                result.append(char)
            elif char in ' \t\n\r':
                result.append(char)
            else:
                replaced.append((char, ''))
        
        if verbose and replaced:
            print(f"Replaced {len(replaced)} character(s):")
            for orig, repl in set(replaced):
                display_orig = repr(orig)
                display_repl = repr(repl) if repl else '<removed>'
                print(f"  {display_orig} → {display_repl}")
        
        return ''.join(result), replaced
    
    return content, []


def convert_file(input_path, output_path, target_enc, clean_mode, force, bom_flag, 
                 dry_run, verbose, quiet):
    """Process a single file through cleaning and conversion."""
    
    # Detect input encoding
    detected_enc = detect_encoding(input_path)
    if detected_enc is None:
        if not quiet:
            print(f"ERROR: Cannot detect encoding for {input_path}. Skipping.", file=sys.stderr)
        return False
    
    if not quiet:
        action = "OVERWRITE IN-PLACE" if force else "CONVERT TO NEW FILE"
        print(f"Input: {input_path}")
        print(f"  Action: {action}")
        print(f"  Detected encoding: {detected_enc}")
        print(f"  Target encoding: {target_enc}")
        print(f"  Clean mode: {clean_mode}")
    
    if dry_run:
        if not quiet:
            target_desc = "ORIGINAL (if forced)" if force else str(output_path)
            print(f"  [DRY-RUN] Would write to: {target_desc}")
        return True
    
    # Safety Check: If NOT forcing and output exists, ask for permission
    # Note: If -f is true, we bypass this check regardless of existence.
    if not force and os.path.exists(output_path):
        response = input(f"Output file {output_path} exists. Overwrite? [y/N]: ")
        if response.lower() not in ('y', 'yes'):
            if not quiet:
                print("  Skipping (user declined).")
            return True
    
    try:
        # Read with detected encoding
        with open(input_path, 'r', encoding=detected_enc, errors='surrogateescape') as f:
            content = f.read()
        
        original_size = len(content.encode(detected_enc))
        
        # Clean content
        cleaned, replacements = clean_content(content, clean_mode, verbose=verbose)
        cleaned_size = len(cleaned.encode('utf-8'))
        
        # Determine BOM setting
        use_bom = bom_flag if bom_flag is not None else (target_enc.startswith('utf-16'))
        
        # Write with target encoding
        # OPENING IN 'wb' MODE ensures we can write raw bytes and handle BOM manually
        encoding_map = {
            'utf-8': 'utf-8',
            'utf-16': 'utf-16',
            'utf-16-le': 'utf-16-le',
            'utf-16-be': 'utf-16-be',
        }
        target_codec = encoding_map.get(target_enc, 'utf-8')
        
        # Open for writing (truncates existing file if it exists, which is what we want for -f)
        with open(output_path, 'wb') as f:
            if use_bom and target_enc.startswith('utf-16'):
                # Manual BOM handling for consistency across codecs
                if target_enc == 'utf-16' or 'le' in target_enc:
                    f.write(b'\xff\xfe') # LE
                else:
                    f.write(b'\xfe\xff') # BE
            
            encoded = cleaned.encode(target_codec)
            f.write(encoded)
        
        size_change = ((cleaned_size - original_size) / original_size) * 100 if original_size > 0 else 0
        
        if not quiet:
            print(f"  Output written: {output_path}")
            print(f"  Size change: {size_change:+.1f}% ({original_size} → {cleaned_size} bytes)")
            if replacements and not verbose:
                print(f"  Characters replaced: {len(replacements)} (use --verbose for details)")
            print(f"  Status: SUCCESS")
        
        return True
        
    except UnicodeDecodeError as e:
        if not quiet:
            print(f"ERROR: Decoding failed: {e}", file=sys.stderr)
        return False
    except Exception as e:
        if not quiet:
            print(f"ERROR: Processing failed: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Unicode text file converter and cleaner.',
        add_help=False,
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    parser.add_argument('-h', '--help', action='store_true', help='Show help message')
    parser.add_argument('-v', '--version', action='store_true', help='Show version number')
    parser.add_argument('-s', '--setup', action='store_true', help='Create symlink in ~/bin/')
    parser.add_argument('-t', '--target-encoding', dest='target_enc', 
                       default='utf-8', choices=['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be'],
                       help='Output encoding')
    parser.add_argument('-c', '--clean', choices=['none', 'printable', 'ascii'], default='none',
                       help='Character cleaning mode')
    parser.add_argument('-f', '--force', action='store_true', help='Overwrite original files in-place')
    parser.add_argument('-i', '--input-dir', dest='input_dir', 
                       help='Alternative input directory')
    parser.add_argument('-o', '--output-dir', dest='output_dir',
                       help='Alternative output directory')
    parser.add_argument('--bom', action='store_true', default=None, help='Include BOM')
    parser.add_argument('--no-bom', action='store_false', dest='bom',
                       help='Exclude BOM from output')
    parser.add_argument('--dry-run', action='store_true', help='Preview only, no changes')
    parser.add_argument('-r', '--recursive', action='store_true', help='Recursive processing')
    parser.add_argument('--verbose', action='store_true', help='Show replacement details')
    parser.add_argument('--quiet', action='store_true', help='Suppress non-error output')
    parser.add_argument('files', nargs='*', metavar='FILE', help='Input file(s) to process')
    
    args = parser.parse_args()
    
    # Handle help
    if args.help:
        print(USAGE % {'prog': os.path.basename(sys.argv[0])})
        sys.exit(0)
    
    # Handle version
    if args.version:
        print(f"utf-conv.py v{VERSION}")
        sys.exit(0)
    
    # Handle setup
    if args.setup:
        success = setup_symlink()
        sys.exit(0 if success else 1)
    
    # Validate input files
    if not args.files:
        print(USAGE % {'prog': os.path.basename(sys.argv[0])}, file=sys.stderr)
        print("\nError: No input files specified.", file=sys.stderr)
        sys.exit(1)
    
    # Conflict Check: -f and -o together usually don't make sense for "in-place"
    # But if user specifies -o, we respect that as "redirect".
    # If -f is set but -o is NOT set, we target the INPUT file.
    
    # Collect all files to process
    all_files = []
    for pattern in args.files:
        path = Path(pattern)
        if path.is_file():
            all_files.append(path)
        elif '*' in str(pattern):
            parent = path.parent if path.parent != Path('.') else Path.cwd()
            matches = list(parent.glob(path.name)) if parent != path else list(Path.cwd().glob(path.name))
            all_files.extend(m for m in matches if m.is_file())
        elif path.is_dir():
            if not args.recursive:
                if not args.quiet:
                    print(f"WARNING: {pattern} is a directory (use -r for recursive). Skipping.", file=sys.stderr)
            else:
                all_files.extend([f for f in path.rglob('*') if f.is_file()])
        else:
            if not args.quiet:
                print(f"WARNING: {pattern} does not exist. Skipping.", file=sys.stderr)
    
    if not all_files:
        print("Error: No valid input files found.", file=sys.stderr)
        sys.exit(1)
    
    # Process each file
    total = len(all_files)
    successful = 0
    
    for idx, filepath in enumerate(all_files, 1):
        if not args.quiet:
            print(f"\n[{idx}/{total}] Processing: {filepath}")
        
        # --- DETERMINE OUTPUT PATH LOGIC ---
        if args.output_dir:
            # User explicitly requested a different output directory
            output_dir = Path(args.output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            # Always add suffix here to avoid collision in shared folder
            output_path = output_dir / f"{filepath.stem}_converted.{filepath.suffix}"
        elif args.force:
            # User requested force AND did not specify output dir -> OVERWRITE INPUT
            output_path = filepath
        else:
            # Default behavior: Create new file with _converted suffix
            output_path = filepath.parent / f"{filepath.stem}_converted{filepath.suffix}"
        # -----------------------------------
        
        success = convert_file(
            input_path=filepath,
            output_path=output_path,
            target_enc=args.target_enc,
            clean_mode=args.clean,
            force=args.force,
            bom_flag=args.bom,
            dry_run=args.dry_run,
            verbose=args.verbose,
            quiet=args.quiet
        )
        
        if success:
            successful += 1
    
    # Summary
    if not args.quiet:
        print(f"\n{'='*60}")
        print(f"Summary: {successful}/{total} files processed successfully")
        if successful < total:
            print("WARNING: Some files failed processing.")
            sys.exit(1)
        else:
            print("All files processed successfully.")
    
    sys.exit(0 if successful == total else 1)


if __name__ == '__main__':
    main()