#!/bin/bash
# git-patch-checkout.sh
#
# Prepares the working directory for a patch iteration.
# - Warns if there are uncommitted changes
# - Fetches latest from remote (if available)
# - Ensures we're on a clean state

set -e

# Check for uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
    echo "WARNING: Uncommitted changes detected in working directory."
    echo "These changes may be overwritten or cause conflicts."
    echo "Consider committing or stashing them before running claude-farmer."
    echo ""
 fi

# Check for untracked files that might be important
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -5)
if [ -n "$UNTRACKED" ]; then
    echo "Note: Untracked files present (showing first 5):"
    echo "$UNTRACKED"
    echo ""
fi

# Fetch from remote if available (don't fail if no remote)
if git remote | grep -q .; then
    git fetch --quiet 2>/dev/null || true
fi

echo "Ready for patch iteration."
