#!/bin/bash
set -e

echo ">>> Installing markdown-to-pdf CLI dependencies..."

# Core tools
brew install pandoc
brew install basictex

# Add basictex to PATH
eval "$(/usr/libexec/path_helper)"

# Install additional LaTeX packages (need sudo because basictex was installed with sudo)
echo ">>> Installing LaTeX packages (requires sudo)..."
sudo tlmgr update --self
sudo tlmgr install collection-fontsrecommended
sudo tlmgr install geometry setspace parskip titlesec

# Create ~/bin directory if it doesn't exist
mkdir -p "$HOME/bin"

# Create symlink from ~/bin/md2pdf to this script
ln -sf "$(pwd)/md2pdf.js" "$HOME/bin/md2pdf"

# Ensure ~/bin is in PATH
if ! grep -q '\$HOME/bin' "$HOME/.zshrc"; then
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.zshrc"
fi

echo "[OK] All dependencies installed successfully"
echo "[OK] Symlink created: $HOME/bin/md2pdf"
echo "[OK] $HOME/bin added to PATH"
echo ""
echo "IMPORTANT: Restart your terminal or run:"
echo "  source ~/.zshrc"
echo ""
