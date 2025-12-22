#!/bin/bash
#
# Git utilities for feature versioning.
# Creates a new patch branch for a feature.
#
# Usage: ./git-patch-checkout.sh <feature_name>
#
# Assumes we're on the feature branch: features/<feature_name>
#
# Example: ./git-patch-checkout.sh core
#   - Reads current version from git tag (e.g., features/core/v1.0.5)
#   - Increments patch: 1.0.5 → 1.0.6
#   - Creates branch: features/core/v1.0.6

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <feature_name>"
  exit 1
fi

FEATURE_NAME="$1"
FEATURE_BRANCH="features/${FEATURE_NAME}"
TAG_PATTERN="features/${FEATURE_NAME}/v*"

# Ensure we're on the feature branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$FEATURE_BRANCH" ]; then
  echo "Switching to feature branch: $FEATURE_BRANCH"
  git checkout "$FEATURE_BRANCH"
fi

# Get latest version from git tags (default 0.0.0)
get_version() {
  local latest_tag
  latest_tag=$(git tag -l "$TAG_PATTERN" --sort=-v:refname 2>/dev/null | head -n1)

  if [ -z "$latest_tag" ]; then
    echo "0.0.0"
    return
  fi

  # Extract version from tag (e.g., features/core/v1.2.3 → 1.2.3)
  echo "$latest_tag" | sed 's/.*v\([0-9]*\.[0-9]*\.[0-9]*\)$/\1/'
}

# Increment patch version
increment_patch() {
  local version="$1"
  local major minor patch

  IFS='.' read -r major minor patch <<< "$version"
  patch=$((patch + 1))

  echo "${major}.${minor}.${patch}"
}

# Main
OLD_VERSION=$(get_version)
NEW_VERSION=$(increment_patch "$OLD_VERSION")
BRANCH="features/${FEATURE_NAME}/v${NEW_VERSION}"

echo "Feature: $FEATURE_NAME"
echo "Old version: $OLD_VERSION"
echo "New version: $NEW_VERSION"
echo "Branch: $BRANCH"
echo ""

git checkout -b "$BRANCH"

echo ""
echo "Created branch: $BRANCH"
