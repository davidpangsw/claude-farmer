#!/bin/bash
# git-patch-complete.sh
# Commits all changes in the working directory with a provided message.
#
# Usage: git-patch-complete.sh [commit_message]
#
# If no commit message is provided, uses a default message.

set -e

COMMIT_MESSAGE="${1:-claude-farmer: automated update}"

# Add all changes
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "No changes to commit"
    exit 0
fi

# Commit with the provided message
git commit -m "$COMMIT_MESSAGE"

echo "Changes committed successfully"
