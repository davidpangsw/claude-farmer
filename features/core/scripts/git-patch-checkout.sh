#!/bin/bash
# Prepares the working directory for a patch iteration.
# Ensures we're on a clean state before making changes.

set -e

# Fetch latest from remote (if configured)
if git remote get-url origin &>/dev/null; then
  git fetch origin 2>/dev/null || true
fi

# Check for uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "Warning: Uncommitted changes detected" >&2
fi

echo "Ready for patch iteration"
