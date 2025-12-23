```markdown
# Review

## Summary
CLI implemented but not wired as executable; git scripts complete; all previous high-priority items resolved.

## Goal Alignment
- [x] Review task: reads GOAL, source → produces REVIEW.md
- [x] Develop task: reads GOAL, REVIEW, source → produces code edits  
- [x] Patch command: orchestrates review → develop → commit loop
- [x] Tasks not exposed: only commands exported in index.ts
- [x] Logging with rotation (100 files max)
- [x] Real-time logging via appendFile
- [x] Exponential backoff with reset on edits
- [x] Graceful shutdown handling (SIGINT/SIGTERM)
- [x] Path validation in develop task
- [x] --dry-run option implemented
- [x] Git uncommitted changes warning (git-patch-checkout.sh:11-17)
- [ ] CLI not executable: no package.json bin field to register `claude-farmer` command

## Suggestions

### High Priority
1. **Add package.json bin field** - CLI exists at `cli.ts` but cannot be invoked as `claude-farmer patch`:
   - Need `package.json` with `"bin": {"claude-farmer": "./dist/cli.js"}`
   - Need build step to compile TypeScript to `dist/`
   - Current shebang `#!/usr/bin/env node` is correct but needs compiled JS

### Medium Priority
1. **Add tsconfig.json outDir** - Ensure TypeScript compiles to `dist/` directory for bin field to work

2. **Improve JSON parsing robustness** (`claude/index.ts:78-130`)
   - `extractArrayCandidates` doesn't handle escaped brackets in strings
   - Edge case: `[{"path": "x", "content": "[test]"}]` may fail
   - Consider using a proper JSON streaming parser for large outputs

### Low Priority
1. **Add `--verbose` flag** to CLI for debugging AI responses
2. **Consider `--max-iterations` option** for CI/CD usage

## Next Steps
1. Create package.json with bin field and build configuration
2. Add build script (`tsc` or bundler) to compile cli.ts → dist/cli.js
3. Test CLI installation with `npm link`
```
