#!/bin/bash
#
# Complete a patch: commit all changes with a meaningful message.
#
# Usage: ./git-patch-complete.sh [commit_message]
#
# Default message: "patch update"

set -e

COMMIT_MSG="${1:-patch update}"

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi

# Commit all changes
git add -A
git commit -m "$COMMIT_MSG

🤖 Generated with claude-farmer"

echo "Committed: $COMMIT_MSG"
