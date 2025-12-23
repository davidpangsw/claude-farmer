#!/bin/bash
# Complete patch iteration by staging all changes and committing.
# Usage: git-patch-complete.sh "commit message"

set -e

COMMIT_MSG="${1:-claude-farmer: automated patch}"

# Stage all changes
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi

# Commit with the provided message
git commit -m "$COMMIT_MSG"

echo "Changes committed successfully"
