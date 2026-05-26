# Zsh — convert all .md files in current directory
for f in *.md; do ./md2pdf_chrome.zsh "$f"; done

# Python
for f in *.md; do python3 md2pdf_chrome.py "$f"; done

# Node
for f in *.md; do node md2pdf_puppeteer.mjs "$f"; done