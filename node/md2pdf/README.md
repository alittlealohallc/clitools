# md2pdf.js -- Markdown to PDF CLI

Convert markdown and HTML files to crisp, professional PDFs with sensible defaults.

- Paper: US Letter (8.5" x 11")
- Margins: 0.7" all sides
- Font: Charter 11pt
- Engine: Pandoc + pdflatex

---

## Quick Start

### Installation

```zsh
  # Clone or download this directory
  cd md2pdf

  # Install dependencies (one-time)
  chmod +x setup.sh
  ./setup.sh

  # Link to your PATH (optional, for global access)
  chmod +x md2pdf.js
  ln -s "$(pwd)/md2pdf.js" /usr/local/bin/md2pdf
```

---

### Usage

```zsh
  # Single file
  md2pdf.js convert -i document.md -o ./output/

  # Multiple files
  md2pdf.js convert -i file1.md file2.html -o ./pdfs/

  # Entire directory (finds all .md/.mdx/.html files)
  md2pdf.js convert -i ./docs -o ./output/
```

---

## Requirements

| Tool | Purpose | Installed via |   
|----|-------|-----|   
| Node.js 18+ | CLI runtime | Homebrew or nodejs.org |   
| pandoc 2.18+ | Document converter | `brew install pandoc` |   
| basictex | LaTeX engine + fonts | `brew install basictex` |   

---

## Setup Details

setup.sh installs:

```zsh
  # Core tools
  brew install pandoc basictex

  # LaTeX packages for PDF rendering
  tlmgr install collection-fontsrecommended  # Charter font
  tlmgr install geometry setspace parskip titlesec
```

NOTE: First installation may take 5-10 minutes as basictex downloads and 
configures.

---

## Troubleshooting

### "pdflatex: command not found"

After running setup.sh, reload your shell:

```zsh
  source ~/.zshrc
  # or for bash:
  source ~/.bash_profile
```

---

### "Charter font not found"

Ensure LaTeX fonts are installed:

```zsh
  tlmgr install collection-fontsrecommended
```

---

### PDF output looks wrong

  - Margins off: Edit letter-template.tex and adjust margin=0.7in
  - Font not rendering: Verify Charter is installed with: `fc-list | grep -i charter`
  - Pandoc errors: Check markdown syntax

---

## File Structure

```text
  md2pdf/
  ├── md2pdf.js                 # Main CLI script
  ├── letter-template.tex       # LaTeX template
  ├── setup.sh                  # Dependency installer
  ├── README.md                 # This file
  └── package.json              # Node dependencies
```

---

## Examples

Example 1: Convert single markdown

```node
  md2pdf.js convert -i report.md -o ./reports/
  # Output: ./reports/report.pdf
```

Example 2: Batch convert all markdown in folder

```node
  md2pdf.js convert -i ./src/docs -o ./dist/pdfs/
```

Example 3: Convert HTML file

```node
  md2pdf.js convert -i index.html -o ./
```

---

## Customization

### Change Paper Size

Edit `letter-template.tex`:

```text
  \usepackage[
    margin=0.7in,
    papersize=a4              % Change to 'a4', 'legal', etc.
  ]{geometry}
```

---

### Change Font

Replace Charter in `letter-template.tex`:

```text
  \setmainfont{Helvetica}    % Or any installed font
```

---

### Change Margins

Edit the `margin=` parameter:

```text
  \usepackage[
    margin=1in,              % Change from 0.7in
    papersize=letter
  ]{geometry}
```

---

## Development Notes

  - Template variables: The LaTeX template supports Pandoc variables like 
    `$title$, $author$, $date$`
  - Input formats: Supports `.md, .mdx, .html, .htm`
  - Frontmatter: `YAML` frontmatter is automatically processed

---

## License

MIT
