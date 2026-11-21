#!/bin/bash
# Runs the given program build and fails it when the compiler reports a function whose stack frame is over the limit.
set -euo pipefail

log=$(mktemp)
trap 'rm -f "$log"' EXIT

"$@" 2>&1 | tee "$log"

if grep "overflows the maximum allowed frame space" "$log"; then
  echo "error: the functions above use more stack than one frame allows; box large accounts or move large values to the heap" >&2
  exit 1
fi
