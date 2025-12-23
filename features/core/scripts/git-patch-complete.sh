#!/bin/bash
# git-patch-complete.sh
#
# Completes a patch iteration by committing changes.
# Usage: git-patch-complete.sh "commit message"

set -e

COMMIT_MSG="${1:-claude-farmer: automated update}"

# Check if there are any changes to commit
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
    # Check for untracked files
    if [ -z "$(git ls-files --others --exclude-standard)" ]; then
        echo "No changes to commit."
        exit 0
    fi
fi

# Stage all changes (including new files, excluding .gitignore patterns)
git add -A

# Check again if there's anything staged
if git diff --cached --quiet 2>/dev/null; then
    echo "No changes staged for commit."
    exit 0
fi

# Commit with the provided message
git commit -m "$COMMIT_MSG"

echo "Changes committed successfully."
