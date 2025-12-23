#!/bin/bash
# git-patch-checkout.sh
#
# Prepares the working directory for a patch iteration.
# Called before each review/develop cycle.
#
# Usage: git-patch-checkout.sh
#
# Verifies:
# - Working directory is a git repository
# - Warns if uncommitted changes exist (but doesn't fail)

set -e

# Verify this is a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not a git repository" >&2
    exit 1
fi

# Check for uncommitted changes and warn (but don't fail)
if ! git diff --quiet HEAD 2>/dev/null; then
    echo "Warning: Uncommitted changes detected. Consider committing or stashing before running claude-farmer." >&2
fi

# Check for untracked files in the working directory (excluding claude-farmer/)
untracked=$(git ls-files --others --exclude-standard | grep -v '^claude-farmer/' | head -5)
if [ -n "$untracked" ]; then
    echo "Warning: Untracked files detected (showing first 5):" >&2
    echo "$untracked" | sed 's/^/  /' >&2
fi

echo "Git repository verified"
