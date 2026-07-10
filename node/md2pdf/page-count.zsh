# brew install poppler (provides pdfinfo)
for f in *.pdf; do
  echo "$(pdfinfo $f | awk '/Pages/{print $2}') pages: $f"
done