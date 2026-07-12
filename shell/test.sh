# Source - https://stackoverflow.com/a/24565095
# Posted by Reinstate Monica Please, modified by community. See post 'Timeline' for change history
# Retrieved 2026-07-10, License - CC BY-SA 3.0

#!/bin/bash

dir='.performance_test'

setup() {
  mkdir "$dir" || exit 1
  mkdir -p "$dir/prune_me/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/w/x/y/z" \
    "$dir/other"

  find "$dir/prune_me" -depth -type d -exec mkdir '{}'/{A..Z} \;
  find "$dir/prune_me" -type d -exec touch '{}'/{1..1000} \;
  touch "$dir/other/foo"
}

cleanup() {
  rm -rf "$dir"
}

stats() {
  for file in "$dir"/*; do
    if [[ -d "$file" ]]; then
      count=$(find "$file" | wc -l)
      printf "%-30s %-10s\n" "$file" "$count"
    fi
  done
}

name1() {
  find "$dir" -path "$dir/prune_me" -prune -o -exec bash -c 'echo "$0"'  {} \;
}

name2() {
  find "$dir" -not \( -path "$dir/prune_me" -prune \) -exec bash -c 'echo "$0"' {} \;
}

name3() {
  find "$dir" -not -path "$dir/prune_me*" -exec bash -c 'echo "$0"' {} \;
}

printf "Setting up test files...\n\n"
setup
echo "----------------------------------------------"
echo "# of files/dirs in level one directories"
stats | sort -k 2 -n -r
echo "----------------------------------------------"

printf "\nRunning performance test...\n\n"

echo \> find \""$dir"\" -path \""$dir/prune_me"\" -prune -o -exec bash -c \'echo \"\$0\"\'  {} \\\;
name1
s=$(date +%s%N)
name1_num=$(name1 | wc -l)
e=$(date +%s%N)
name1_perf=$((e-s))
printf "  [# of files] $name1_num [Runtime(ns)] $name1_perf\n\n"

echo \> find \""$dir"\" -not \\\( -path \""$dir/prune_me"\" -prune \\\) -exec bash -c \'echo \"\$0\"\' {} \\\;
name2
s=$(date +%s%N)
name2_num=$(name2 | wc -l)
e=$(date +%s%N)
name2_perf=$((e-s))
printf "  [# of files] $name2_num [Runtime(ns)] $name2_perf\n\n"

echo \> find \""$dir"\" -not -path \""$dir/prune_me*"\" -exec bash -c \'echo \"\$0\"\' {} \\\;
name3
s=$(date +%s%N)
name3_num=$(name3 | wc -l)
e=$(date +%s%N)
name3_perf=$((e-s))
printf "  [# of files] $name3_num [Runtime(ns)] $name3_perf\n\n"

echo "Cleaning up test files..."
cleanup
