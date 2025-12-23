# Development Log

## Changes Made

### 1. Fixed REVIEW.md format mismatch (claude/prompts/review.ts)
- Added missing `## Bugs` section with High/Medium priority subsections
- Added missing `## Clarifications Needed` section
- Renamed `## Suggestions` to `## Suggested Improvements` to match GOAL.md

### 2. Ensured DEVELOP.md gets written (tasks/develop/index.ts, claude/prompts/develop.ts)
- Updated develop prompt to explicitly require DEVELOP.md in output
- Added fallback in develop task to generate DEVELOP.md if AI doesn't include one
- DEVELOP.md is now always written to `claude-farmer/docs/DEVELOP.md`

### 3. Fixed logging buffering (logging/index.ts)
- Replaced rotating-file-stream with pino.destination using `sync: true`
- Ensures real-time log streaming without buffering per GOAL.md
- Changed from UTC (toISOString) to OS local time for log filenames
- Implemented manual log cleanup (keeping last 30 files) using fs operations

### 4. Created utils/ directory (utils/path.ts, utils/index.ts)
- Extracted `isPathWithinWorkingDir` to `utils/path.ts`
- Created `utils/index.ts` for re-exports
- Updated `tasks/develop/index.ts` to import from utils

## Problems Encountered

1. **rotating-file-stream buffering**: The library doesn't support sync writes. Switched to pino.destination with manual file cleanup instead. The cleanup is simple file operations, not custom rotation logic.

2. **DEVELOP.md reliability**: AI may not always include DEVELOP.md in its output. Added a fallback mechanism to generate a basic DEVELOP.md from the list of edited files.
