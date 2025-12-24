Now I'll provide my review. The existing REVIEW.md has a good analysis, but I'll verify and expand on it:

# Review

## Summary
Well-structured implementation with a critical JSON parsing bug affecting code with unbalanced brackets.

## Goal Alignment
- [x] Review task produces REVIEW.md with correct format
- [x] Develop task produces code edits and DEVELOP.json
- [x] Tasks not exposed outside module (only `patch`, `develop` exported)
- [x] patch() loops forever by default with `once` option
- [x] develop() defaults to `once: true` per spec
- [x] Exponential backoff (1 min → 2 hours) for no-changes and rate limits
- [x] Never terminates automatically (SIGINT/SIGTERM handlers)
- [x] Logging with OS timestamps, sync streaming, 30-file rotation
- [x] Log files named YYYYMMDD_HHmmss.log
- [x] Path traversal protection via `isPathWithinWorkingDir`
- [x] Helpers in utils/ subdirectory
- [x] AI backend in claude/ subdirectory
- [x] ultrathink option available

## Bugs

### High Priority
1. **JSON bracket extraction fails on unbalanced brackets in strings** (`claude/index.ts:80-102`): `extractArrayCandidates` treats brackets inside JSON strings as structural. Example: `[{"path":"x.ts","content":"arr[0"}]` - the inner `[` increments depth to 2, but there's no matching `]`, so depth never returns to 0 and the array is never captured. Conversely, `[{"path":"x.ts","content":"]"}]` captures prematurely at the inner `]`.

### Medium Priority
1. **Tests define separate parsing logic** (`tests/claude.test.ts:93-116`): Test's `parseFileEdits` uses regex `/\[[\s\S]*?\]/g`, not the production `extractArrayCandidates`. Tests pass but don't validate the actual implementation.

2. **Test's type guard misaligned** (`tests/claude.test.ts:84-91`): Test's `isValidFileEdit` requires `path`/`content` fields only, but production accepts `file`/`code` aliases.

## Clarifications Needed
1. **Web search requirement**: GOAL.md states Review task "Researches best practices via web search". Is this hard requirement or best-effort?

## Suggested Improvements

### High Priority
1. **Fix `extractArrayCandidates` to handle JSON strings** - Track string context by detecting `"` and handling escape sequences (`\"`). Skip bracket counting while inside strings.

2. **Export and test actual parsing function** - Export `parseFileEditsFromOutput` from `claude/index.ts` and import it in tests instead of reimplementing.

### Medium Priority
1. **Add regression tests for bracket edge cases**:
   - `[{"path":"x.ts","content":"arr[0"}]` (unbalanced open)
   - `[{"path":"x.ts","content":"]"}]` (unbalanced close)
   - `[{"path":"x.ts","content":"\"escaped\\\"quote\""}]` (escaped quotes)

2. **Align test's `isValidFileEdit`** - Update test to accept `file`/`code` aliases like production.

## Next Steps
1. Fix `extractArrayCandidates` string handling (critical - edits with brackets silently fail)
2. Export parser and refactor tests to use actual implementation
3. Add edge case tests for JSON parsing
