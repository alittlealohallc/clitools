#!/usr/bin/env python3
"""
Resume & Cover Letter PDF Generator (v3.1 - Final)
Enhancements:
  - Output filename sanitization (lowercase, hyphens).
  - Cleanup existing wrapper on --setup.
  - Fixes fpdf2 deprecation warnings.
  - Strips HTML tags for clean text rendering.
"""

import os
import sys
import argparse
import re
import html
from pathlib import Path

try:
    import markdown
    HAS_MARKDOWN = True
except ImportError:
    HAS_MARKDOWN = False
    print("⚠️  WARNING: 'markdown' library not found. Using built-in fallback parser.")

try:
    from fpdf import FPDF, XPos, YPos
except ImportError:
    print("ERROR: Missing dependency: fpdf2")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MARGIN_IN = 0.7
MARGIN_MM = MARGIN_IN * 25.4
PAGE_W_MM = 215.9
PAGE_H_MM = 279.4

FONT_NAME = "Cambria"
FONT_SIZE_BODY = 11
FONT_SIZE_HEADER = 12
FONT_SIZE_CONTACT = 10

WORD_DFONT_BASE = "/Applications/Microsoft Word.app/Contents/Resources/DFonts"
CAMBRIA_FONTS = {
    "":   os.path.join(WORD_DFONT_BASE, "Cambria.ttc"),
    "B":  os.path.join(WORD_DFONT_BASE, "Cambriab.ttf"),
    "I":  os.path.join(WORD_DFONT_BASE, "Cambriai.ttf"),
    "BI": os.path.join(WORD_DFONT_BASE, "Cambriaz.ttf"),
}

TIMES_PATHS = [
    "/Library/Fonts/Times New Roman.ttf",
    os.path.expanduser("~/Library/Fonts/Times New Roman.ttf"),
    "C:/Windows/Fonts/times.ttf",
]

MARKDOWN_SEPARATOR = "<!-- COVER LETTER START -->"
DOUBLE_DASH_SEPARATOR = "---\n---"

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def find_font(paths):
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def get_font_map():
    if all(os.path.exists(p) for p in CAMBRIA_FONTS.values()):
        return CAMBRIA_FONTS, FONT_NAME
    else:
        times = find_font(TIMES_PATHS)
        if times:
            return {"": times, "B": times, "I": times, "BI": times}, "TimesNewRoman"
        else:
            print("ERROR: Could not find Cambria or Times New Roman.")
            sys.exit(1)

def sanitize_filename(filename):
    """
    Converts filename to lowercase and replaces spaces/underscores with hyphens.
    Removes non-alphanumeric characters except hyphens.
    """
    # Convert to lowercase
    name = filename.lower()
    
    # Replace spaces and underscores with hyphens
    name = re.sub(r'[\s_]+', '-', name)
    
    # Remove any character that isn't alphanumeric or a hyphen
    name = re.sub(r'[^a-z0-9-]', '', name)
    
    # Replace multiple consecutive hyphens with a single one
    name = re.sub(r'-+', '-', name)
    
    # Strip leading/trailing hyphens
    name = name.strip('-')
    
    return name

def setup_wrapper():
    script_path = os.path.abspath(__file__)
    bin_dir = os.path.expanduser("~/bin")
    wrapper_name = "resume-gen"
    wrapper_path = os.path.join(bin_dir, wrapper_name)
    
    # Ensure bin directory exists
    if not os.path.exists(bin_dir):
        os.makedirs(bin_dir)
        print(f"Created directory: {bin_dir}")
    
    # CLEANUP: Delete if it already exists (file or link)
    if os.path.islink(wrapper_path) or os.path.exists(wrapper_path):
        try:
            os.remove(wrapper_path)
            print(f"🗑️  Removed existing: {wrapper_path}")
        except OSError as e:
            print(f"⚠️  Could not remove {wrapper_path}: {e}")
            # Try to continue anyway, maybe permissions issue
    
    # Create the shell wrapper content
    wrapper_content = f"""#!/bin/zsh
exec "{sys.executable}" "{script_path}" "$@"
"""
    
    # Write the wrapper
    with open(wrapper_path, 'w') as f:
        f.write(wrapper_content)
    
    # Make executable
    os.chmod(wrapper_path, 0o755)
    
    print(f"✅ Wrapper created: {wrapper_path}")
    print(f"   Add to PATH: export PATH=\"$HOME/bin:$PATH\"")

def extract_header_info(text_block):
    lines = text_block.strip().split('\n')
    name = ""
    contact_lines = []
    idx = 0
    
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    
    if idx >= len(lines):
        return "", [], text_block

    name = lines[idx].strip()
    idx += 1
    
    while idx < len(lines) and len(contact_lines) < 3:
        line = lines[idx].strip()
        if not line:
            idx += 1
            continue
        
        if '@' in line or '.' in line or '+' in line or '(' in line or len(line) < 80:
            if line.startswith('#') or line.startswith('---'):
                break
            contact_lines.append(line)
        else:
            break
        idx += 1
        
    remaining = '\n'.join(lines[idx:])
    return name, contact_lines, remaining

def split_document(content):
    content = content.replace('\r\n', '\n')
    
    sep_idx = -1
    sep_type = None
    
    if MARKDOWN_SEPARATOR in content:
        sep_idx = content.find(MARKDOWN_SEPARATOR)
        sep_type = "MARKDOWN"
    elif DOUBLE_DASH_SEPARATOR in content:
        sep_idx = content.find(DOUBLE_DASH_SEPARATOR)
        sep_type = "DOUBLE_DASH"
    
    if sep_idx == -1:
        return content, "", "single"

    part1 = content[:sep_idx].strip()
    part2 = content[sep_idx + len(sep_type == "DOUBLE_DASH" and DOUBLE_DASH_SEPARATOR or MARKDOWN_SEPARATOR):].strip()
    
    p1_lower = part1.lower()
    p2_lower = part2.lower()
    
    is_p1_resume = any(k in p1_lower for k in ["experience", "skills", "education", "professional"])
    is_p1_letter = any(k in p1_lower for k in ["dear", "sincerely", "date", "cover letter"])
    is_p2_resume = any(k in p2_lower for k in ["experience", "skills", "education", "professional"])
    is_p2_letter = any(k in p2_lower for k in ["dear", "sincerely", "date", "cover letter"])
    
    cover_text = ""
    resume_text = ""
    
    if is_p1_letter and is_p2_resume:
        cover_text, resume_text = part1, part2
    elif is_p1_resume and is_p2_letter:
        cover_text, resume_text = part2, part1
    elif is_p1_letter:
        cover_text, resume_text = part1, part2
    elif is_p2_letter:
        cover_text, resume_text = part2, part1
    else:
        cover_text, resume_text = part1, part2

    return cover_text, resume_text, "split"

def parse_markdown_fallback(text):
    html_out = ""
    lines = text.split('\n')
    in_list = False
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_list: html_out += "</ul>\n"; in_list = False
            html_out += "<p></p>"
            continue
        
        if stripped.startswith('### '):
            if in_list: html_out += "</ul>\n"; in_list = False
            html_out += f"<h3>{stripped[4:]}</h3>\n"
        elif stripped.startswith('## '):
            if in_list: html_out += "</ul>\n"; in_list = False
            html_out += f"<h2>{stripped[3:]}</h2>\n"
        elif stripped.startswith('# '):
            if in_list: html_out += "</ul>\n"; in_list = False
            html_out += f"<h1>{stripped[2:]}</h1>\n"
        elif stripped.startswith('**') and stripped.endswith('**'):
            html_out += f"<p><strong>{stripped[2:-2]}</strong></p>\n"
        elif stripped.startswith('- ') or stripped.startswith('* '):
            if not in_list:
                html_out += "<ul>\n"
                in_list = True
            txt = re.sub(r'^[-*]\s+', '', stripped)
            txt = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', txt)
            txt = re.sub(r'\*(.*?)\*', r'<em>\1</em>', txt)
            html_out += f"<li>{txt}</li>\n"
        else:
            if in_list:
                html_out += "</ul>\n"
                in_list = False
            txt = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', stripped)
            txt = re.sub(r'\*(.*?)\*', r'<em>\1</em>', txt)
            html_out += f"<p>{txt}</p>\n"
            
    if in_list:
        html_out += "</ul>\n"
    return html_out

def convert_to_html(text):
    if not text.strip():
        return ""
    if HAS_MARKDOWN:
        md = markdown.Markdown(extensions=['extra', 'codehilite'])
        return md.convert(text)
    else:
        return parse_markdown_fallback(text)

def clean_text(html_str):
    if not html_str:
        return ""
    text = re.sub(r'<[^>]+>', '', html_str)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ---------------------------------------------------------------------------
# PDF Builder
# ---------------------------------------------------------------------------

class ResumePDF(FPDF):
    def __init__(self, font_name):
        super().__init__(orientation="P", unit="mm", format="Letter")
        self.font_name = font_name
        self.set_margins(MARGIN_MM, MARGIN_MM, MARGIN_MM)
        self.set_auto_page_break(auto=True, margin=MARGIN_MM)
        
        font_map, _ = get_font_map()
        for style, path in font_map.items():
            self.add_font(font_name, style, path) # Removed uni=True

    def draw_header(self, name, contact_lines):
        self.set_font(self.font_name, "B", 14)
        self.set_text_color(0, 0, 0)
        self.cell(0, 8, name, new_x=XPos.CENTER, new_y=YPos.NEXT, align="C")
        
        self.set_font(self.font_name, "", FONT_SIZE_CONTACT)
        self.set_text_color(60, 60, 60)
        for line in contact_lines:
            self.cell(0, 5, line, new_x=XPos.CENTER, new_y=YPos.NEXT, align="C")
        self.ln(4)

    def section_heading(self, text):
        self.ln(3)
        self.set_font(self.font_name, "B", FONT_SIZE_HEADER)
        self.set_text_color(0, 0, 0)
        self.cell(0, 6, text.upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def render_html(self, html_content):
        if not html_content:
            return
            
        lines = html_content.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith('<h1>'):
                txt = clean_text(line)
                self.set_font(self.font_name, "B", 14)
                self.cell(0, 6, txt, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                self.ln(2)
            elif line.startswith('<h2>'):
                txt = clean_text(line)
                self.section_heading(txt)
            elif line.startswith('<h3>'):
                txt = clean_text(line)
                self.set_font(self.font_name, "B", 11)
                self.cell(0, 5, txt, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                self.ln(1)
            elif line.startswith('<hr'):
                self.line(self.x, self.y, self.w - self.r_margin, self.y)
                self.ln(2)
            elif line.startswith('<li>'):
                txt = clean_text(line)
                self.set_font(self.font_name, "", FONT_SIZE_BODY)
                self.set_text_color(0, 0, 0)
                bullet = "\u2022"
                bw = self.get_string_width(bullet + " ")
                self.cell(bw, 5, bullet, new_x=XPos.RIGHT, new_y=YPos.TOP)
                self.multi_cell(self.w - self.l_margin - self.r_margin - bw, 5, txt, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            elif line.startswith('<p>') or line.startswith('<div>'):
                txt = clean_text(line)
                if txt:
                    self.set_font(self.font_name, "", FONT_SIZE_BODY)
                    self.set_text_color(0, 0, 0)
                    self.multi_cell(self.w - self.l_margin - self.r_margin, 5, txt, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            else:
                if line:
                    self.set_font(self.font_name, "", FONT_SIZE_BODY)
                    self.set_text_color(0, 0, 0)
                    self.multi_cell(self.w - self.l_margin - self.r_margin, 5, line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate Resume/Cover Letter PDF")
    parser.add_argument('input_file', nargs='?', help="Path to markdown file")
    parser.add_argument('--setup', action='store_true', help="Create shell wrapper 'resume-gen'")
    parser.add_argument('-o', '--output', help="Output filename")
    
    args = parser.parse_args()

    if args.setup:
        setup_wrapper()
        return

    if not args.input_file:
        print("Error: No input file specified.")
        print("Usage: resume-gen <file.md> [--setup]")
        sys.exit(1)

    if not os.path.exists(args.input_file):
        print(f"Error: File not found: {args.input_file}")
        sys.exit(1)

    with open(args.input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    cover_raw, resume_raw, mode = split_document(content)
    primary_text = cover_raw if cover_raw else resume_raw
    name, contact_lines, _ = extract_header_info(primary_text)
    
    if not name:
        print("Error: Could not detect Name/Contact info.")
        sys.exit(1)

    cover_html = convert_to_html(cover_raw) if cover_raw else ""
    resume_html = convert_to_html(resume_raw) if resume_raw else ""

    # Determine Output Filename
    if args.output:
        output_filename = args.output
    else:
        base = os.path.splitext(os.path.basename(args.input_file))[0]
        output_filename = base
    
    # SANITIZE FILENAME
    safe_filename = sanitize_filename(output_filename)
    output_path = f"{safe_filename}.pdf"

    pdf = ResumePDF(FONT_NAME)
    pdf.add_page()
    
    pdf.draw_header(name, contact_lines)
    
    if cover_html:
        pdf.render_html(cover_html)
        if resume_html:
            pdf.add_page()
            pdf.render_html(resume_html)
    else:
        pdf.render_html(resume_html)

    pdf.output(output_path)
    print(f"✅ Generated: {output_path} ({pdf.page} pages)")
    if mode == "split":
        print("   Detected: Cover Letter + Resume (Reordered)")
    else:
        print("   Detected: Single Document")

if __name__ == "__main__":
    main()