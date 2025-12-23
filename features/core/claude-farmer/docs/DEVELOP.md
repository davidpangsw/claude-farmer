# Development Log

## Changes Made

1. **logging/index.ts** - Added stream cleanup callback to remove streams from cache when closed, preventing memory leak when patch() is called on different working directories

2. **context.ts** - Added `.git/**` to IGNORE_PATTERNS to skip git internal files that could match source patterns and waste context tokens

3. **tasks/develop/index.ts** - Changed path traversal warnings from console.warn to returning them in the DevelopResult, so security events appear in iteration log files

4. **types.ts** - Added optional `warnings` field to DevelopResult interface

5. **commands/patch/index.ts** - Updated to log path traversal warnings from develop task

6. **commands/develop/index.ts** - Updated to log path traversal warnings from develop task

## Problems Encountered

- None