#!/bin/bash
# Completes a patch iteration by staging and committing changes.
# Usage: git-patch-complete.sh "commit message"

set -e

COMMIT_MESSAGE="${1:-claude-farmer: automated update}"

# Stage all changes
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi

# Commit with the provided message
git commit -m "$COMMIT_MESSAGE"

echo "Committed: $COMMIT_MESSAGE"
