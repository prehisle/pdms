#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

RED() { printf "\033[31m%s\033[0m\n" "$*"; }
GREEN() { printf "\033[32m%s\033[0m\n" "$*"; }
YELLOW() { printf "\033[33m%s\033[0m\n" "$*"; }

# Collect Markdown files tracked by git
if command -v git >/dev/null 2>&1; then
  MAPFILES=()
  while IFS= read -r f; do MAPFILES+=("$f"); done < <(git -c core.quotepath=false ls-files -- '*.md')
else
  MAPFILES=( $(find . -type f -name "*.md") )
fi

missing=0

for file in "${MAPFILES[@]}"; do
  [[ -f "$file" ]] || continue
  dir="$(dirname "$file")"
  # Extract links in the form [text](link)
  # naive parser: find occurrences of ]( and take until next )
  while IFS= read -r line; do
    # skip empty
    [[ -z "$line" ]] && continue
    # iterate all occurrences per line
    tmp="$line"
    while [[ "$tmp" == *"]("* ]]; do
      right="${tmp#*"]("}"
      link="${right%%)*}"
      # Prepare for next occurrence
      tmp="${right#*)}"

      # Normalize and filter external/anchors
      if [[ "$link" == http://* || "$link" == https://* || "$link" == mailto:* || "$link" == \#* || "$link" == data:* ]]; then
        continue
      fi

      # Remove trailing anchor part (file.md#section)
      link_no_anchor="${link%%#*}"
      # Skip if empty after removal
      [[ -z "$link_no_anchor" ]] && continue

      # Build candidate paths
      candidate="$dir/$link_no_anchor"
      candidate_root="$link_no_anchor"
      # Collapse ./
      candidate="${candidate#./}"
      # If ends with .md, .json, .html etc. check file exists; else also accept directories
      if [[ -e "$candidate" || -e "$candidate_root" ]]; then
        :
      else
        RED "[missing] $file: $link_no_anchor"
        missing=$((missing+1))
      fi
    done
  done < <(nl -ba "$file" | sed 's/^\s*[0-9]\+\s\+//')
done

if (( missing > 0 )); then
  YELLOW "Found $missing missing doc links"
  exit 1
else
  GREEN "All Markdown doc links look good"
fi
