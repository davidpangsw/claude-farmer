#!/bin/bash
# Prepare working tree for patch iteration.
# Stashes any uncommitted changes and pulls latest from remote.

set -e

# Stash any uncommitted changes (if any)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Stashing uncommitted changes..."
  git stash push -m "claude-farmer: auto-stash before patch"
fi

# Pull latest changes with rebase (if remote exists)
if git remote | grep -q .; then
  echo "Pulling latest changes..."
  git pull --rebase || echo "No remote configured or pull failed, continuing..."
else
  echo "No remote configured, skipping pull"
fi

echo "Working tree ready for patch"
