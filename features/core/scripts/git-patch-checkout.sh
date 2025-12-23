#!/bin/bash
# git-patch-checkout.sh
# Prepares the working directory for a new patch iteration.
#
# This script ensures the working directory is in a clean state:
# - Stashes any uncommitted changes (optional, for safety)
# - Fetches latest changes from remote (optional)
# - Ensures we're on a valid branch
#
# Currently a minimal implementation - extend as needed.

set -e

# Ensure we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not a git repository"
    exit 1
fi

echo "Working directory ready for patch iteration"
