#!/bin/bash
#
# Complete a patch: commit, merge to feature branch, and tag.
#
# Usage: ./git-patch-complete.sh <feature_name> [commit_message]
#
# Assumes you're on a subfeature branch like: features/<feature>/v<version>
#
# Example: ./git-patch-complete.sh core "Fix widget rendering"
#   - Commits all changes
#   - Merges to features/core branch
#   - Tags: features/core/v1.0.6

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <feature_name> [commit_message]"
  exit 1
fi

FEATURE_NAME="$1"
COMMIT_MSG="${2:-patch update}"
FEATURE_BRANCH="features/${FEATURE_NAME}"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Extract version from branch name (e.g., features/core/v1.0.6 → 1.0.6)
VERSION=$(echo "$CURRENT_BRANCH" | sed 's/.*\/v\([0-9]*\.[0-9]*\.[0-9]*\)$/\1/')

if [ -z "$VERSION" ] || [ "$VERSION" = "$CURRENT_BRANCH" ]; then
  echo "Error: Cannot extract version from branch name: $CURRENT_BRANCH"
  echo "Expected format: features/<feature>/v<major>.<minor>.<patch>"
  exit 1
fi

TAG="features/${FEATURE_NAME}/v${VERSION}"

echo "Feature: $FEATURE_NAME"
echo "Current branch: $CURRENT_BRANCH"
echo "Feature branch: $FEATURE_BRANCH"
echo "Version: $VERSION"
echo "Tag: $TAG"
echo ""

# 1. Commit all changes
echo "Committing changes..."
git add -A
git commit -m "feat(${FEATURE_NAME}): patch v${VERSION}

${COMMIT_MSG}

🤖 Generated with claude-farmer"

# 2. Merge to feature branch
echo ""
echo "Merging to ${FEATURE_BRANCH}..."
git checkout "$FEATURE_BRANCH"
git merge "$CURRENT_BRANCH" --no-ff -m "Merge ${CURRENT_BRANCH} into ${FEATURE_BRANCH}"

# 3. Tag the new version
echo ""
echo "Tagging ${TAG}..."
git tag "$TAG"

echo ""
echo "Done!"
echo "  - Committed on: $CURRENT_BRANCH"
echo "  - Merged to: $FEATURE_BRANCH"
echo "  - Tagged: $TAG"
