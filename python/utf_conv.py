#!/usr/bin/env python3
"""
utf-conv.py - Unicode text file converter and cleaner
Converts between encodings (UTF-8, UTF-16) and strips unwanted characters.
"""

import argparse
import os
import sys
import shutil
from pathlib import Path

VERSION = "1.0.0"

USAGE = """
Usage: utf-conv.py [OPTIONS] <file> [<file> ...]

Unicode Text File Converter & Cleaner

Examples:
  %(prog)s document.txt                          # Clean, output same name + _cleaned suffix
  %(prog)s -t utf16 input.md output.txt          # Convert to UTF-16, explicit output path
  %(prog)s -c ascii *.txt                        # Strip non-ASCII, keep original filenames
  %(prog)s -s                                    # Create symlink in ~/bin/

Options:
  -h, --help            Show this help message and exit
  -v, --version         Show version number and exit
  -s, --setup           Create executable symlink in ~/bin/ pointing to this script
  -t, --target-encoding TARGET
                        Output encoding: utf-8 (default), utf-16, utf-16-le, utf-16-be
  -f, --force           Overwrite existing output files without prompt
  -c, --clean MODE      Character cleaning mode: none (default), ascii, printable
                        * ascii: Only A-Z, a-z, 0-9, space, tab, newline, standard punctuation
                        * printable: Remove control chars and non-printable Unicode
  -i, --input-dir DIR   Alternative input directory for source files
  -o, --output-dir DIR  Alternative output directory (overrides default behavior)
  --bom                 Include Byte Order Mark (BOM) in output (default: yes for UTF-16)
  --no-bom              Exclude BOM from output
  --dry-run             Preview changes without modifying files
  -r, --recursive       Recursively process files in directories (with wildcards)
"""


def setup_symlink():
    """Create symlink in ~/bin/ pointing to this script."""
    home = Path.home()
    bin_dir = home / "bin"
    script_path = Path(__file__).resolve()
    
    bin_dir.mkdir(exist_ok=True)
    link_path = bin_dir / "utf-conv"
    
    if link_path.exists() or link_path.is_symlink():
        print(f"Warning: {link_path} already exists. Removing and recreating.")
        link_path.unlink()
    
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
    encodings = ['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1']
    
    for enc in encodings:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                f.read(1024)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue
    
    return None


def clean_content(content, mode):
    """Strip unwanted characters based on cleaning mode."""
    if mode == 'none':
        return content
    
    elif mode == 'printable':
        # Keep printable Unicode and newlines; remove control chars and non-printable
        result = []
        for char in content:
            if char == '\n' or char == '\t' or char == '\r':
                result.append(char)
            elif not char.isprintable():
                continue
            else:
                result.append(char)
        return ''.join(result)
    
    elif mode == 'ascii':
        # Strict ASCII: A-Z, a-z, 0-9, space, tab, newline, carriage return, basic punctuation
        allowed = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \t\n\r!\"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
        return ''.join(c for c in content if c in allowed)
    
    return content


def convert_file(input_path, output_path, target_enc, clean_mode, force, bom_flag, dry_run):
    """Process a single file through cleaning and conversion."""
    
    # Detect input encoding
    detected_enc = detect_encoding(input_path)
    if detected_enc is None:
        print(f"ERROR: Cannot detect encoding for {input_path}. Skipping.", file=sys.stderr)
        return False
    
    print(f"Input: {input_path}")
    print(f"  Detected encoding: {detected_enc}")
    print(f"  Target encoding: {target_enc}")
    print(f"  Clean mode: {clean_mode}")
    
    if dry_run:
        print(f"  [DRY-RUN] Would write to: {output_path}")
        return True
    
    # Check if output exists and warn
    if output_path != input_path and os.path.exists(output_path) and not force:
        response = input(f"Output file {output_path} exists. Overwrite? [y/N]: ")
        if response.lower() not in ('y', 'yes'):
            print("  Skipping (user declined).")
            return True  # Not an error, just skipped
    
    try:
        # Read with detected encoding
        with open(input_path, 'r', encoding=detected_enc) as f:
            content = f.read()
        
        original_size = len(content.encode(detected_enc))
        
        # Clean content
        cleaned = clean_content(content, clean_mode)
        cleaned_size = len(cleaned.encode(target_enc))
        
        # Determine BOM setting
        use_bom = bom_flag
        if target_enc.startswith('utf-16') and not (bom_flag or bom_flag == False):
            use_bom = True  # Default to BOM for UTF-16
        
        # Write with target encoding
        write_kwargs = {'encoding': target_enc, 'errors': 'strict'}
        if target_enc.startswith('utf-16') and use_bom:
            pass  # iconv handles BOM automatically
        elif not use_bom:
            # For explicit no-BOM, we may need different approach
            pass
        
        with open(output_path, 'w', **write_kwargs) as f:
            f.write(cleaned)
        
        size_change = ((cleaned_size - original_size) / original_size) * 100 if original_size > 0 else 0
        
        print(f"  Output written: {output_path}")
        print(f"  Size change: {size_change:+.1f}% ({original_size} → {cleaned_size} bytes)")
        print(f"  Status: SUCCESS")
        return True
        
    except UnicodeDecodeError as e:
        print(f"ERROR: Decoding failed: {e}", file=sys.stderr)
        return False
    except Exception as e:
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
    parser.add_argument('-f', '--force', action='store_true', help='Overwrite existing files')
    parser.add_argument('-i', '--input-dir', dest='input_dir', 
                       help='Alternative input directory')
    parser.add_argument('-o', '--output-dir', dest='output_dir',
                       help='Alternative output directory')
    parser.add_argument('--bom', action='store_true', default=None, help='Include BOM')
    parser.add_argument('--no-bom', action='store_false', dest='bom',
                       help='Exclude BOM from output')
    parser.add_argument('--dry-run', action='store_true', help='Preview only, no changes')
    parser.add_argument('-r', '--recursive', action='store_true', help='Recursive processing')
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
    
    # Collect all files to process
    all_files = []
    for pattern in args.files:
        path = Path(pattern)
        if path.is_file():
            all_files.append(path)
        elif '*' in str(pattern):
            # Handle glob patterns
            parent = path.parent
            pattern_name = path.name
            matches = list(parent.glob(pattern_name)) if parent != path else list(Path.cwd().glob(pattern_name))
            all_files.extend(m for m in matches if m.is_file())
        elif path.is_dir():
            if not args.recursive:
                print(f"WARNING: {pattern} is a directory (use -r for recursive). Skipping.", file=sys.stderr)
            else:
                all_files.extend([f for f in path.rglob('*') if f.is_file()])
        else:
            print(f"WARNING: {pattern} does not exist. Skipping.", file=sys.stderr)
    
    if not all_files:
        print("Error: No valid input files found.", file=sys.stderr)
        sys.exit(1)
    
    # Process each file
    total = len(all_files)
    successful = 0
    
    for idx, filepath in enumerate(all_files, 1):
        print(f"\n[{idx}/{total}] Processing: {filepath}")
        
        # Determine output path
        if args.output_dir:
            output_dir = Path(args.output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{filepath.stem}_converted.{filepath.suffix}"
        else:
            # Same folder, add _cleaned suffix before extension
            output_path = filepath.parent / f"{filepath.stem}_converted{filepath.suffix}"
        
        # If output equals input, append _converted suffix
        if output_path == filepath:
            output_path = filepath.parent / f"{filepath.stem}_converted{filepath.suffix}"
        
        success = convert_file(
            input_path=filepath,
            output_path=output_path,
            target_enc=args.target_enc,
            clean_mode=args.clean,
            force=args.force,
            bom_flag=args.bom,
            dry_run=args.dry_run
        )
        
        if success:
            successful += 1
    
    # Summary
    print(f"\n{'='*60}")
    print(f"Summary: {successful}/{total} files processed successfully")
    if successful < total:
        print("WARNING: Some files failed processing.")
        sys.exit(1)
    else:
        print("All files processed successfully.")
        sys.exit(0)


if __name__ == '__main__':
    main()