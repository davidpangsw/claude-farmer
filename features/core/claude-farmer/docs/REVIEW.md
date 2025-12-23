I need permission to write the review file. Here's the review:

---

# Review

## Summary
Git scripts exist; critical gaps are real-time logging (currently buffered) and missing exponential backoff.

## Goal Alignment
- [x] Review task: reads GOAL, source → produces REVIEW.md
- [x] Develop task: reads GOAL, REVIEW, source → produces code edits
- [x] Patch command: orchestrates review → develop → commit loop
- [x] Tasks not exposed: only commands exported in index.ts
- [x] Logging with rotation (100 files max)
- [x] Git scripts exist
- [ ] **Real-time logging**: GOAL says "MUST BE delivered IN REAL TIME", but `logging/index.ts` buffers in memory and writes only at `finalize()`
- [ ] **Exponential backoff**: GOAL specifies 1→2→4→8 min up to 24h, not implemented
- [ ] File patterns: hardcoded `**/*.ts` excludes `.tsx`, `.js`, `.json`, `.md`

## Suggestions

### High Priority
1. **Implement real-time logging** (`logging/index.ts:46-60`)
   - Current: all logs buffered in `this.lines[]`, written at `finalize()`
   - Required: write each log line immediately to file
   - Solution: open file stream on construction, append on each `log()` call

2. **Implement exponential backoff** (`commands/patch/index.ts:75-77`)
   - Current: loop exits when `developResult.edits.length === 0`
   - Required: sleep 1→2→4→8 min... up to 24h, then retry
   - Add: `sleepMs` variable, double on no-edits, cap at 86400000ms

### Medium Priority
1. **Make source file patterns configurable** (`context.ts:36`)
2. **git-patch-checkout.sh is a no-op** - just prints "ready"
3. **Commit message not passed to git script** (`commands/patch/index.ts:72-73`)
4. **Capture git script output to logs** instead of `stdio: "inherit"`

### Low Priority
1. Add integration test with real git repo
2. Add default timeout for AI calls

## Next Steps
1. Refactor `logging/index.ts` to write in real-time
2. Add exponential backoff sleep in patch loop
3. Pass meaningful commit message to git-patch-complete.sh
