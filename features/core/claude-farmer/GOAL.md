# Core Feature Module

Internal specification for developers building claude-farmer.

## What This Module Does

Provides the core functionality of claude-farmer: an automated tool that iteratively improves any codebase through AI-driven review and development cycles.

## Notation

- `$wd` = working directory (the codebase being improved)
- `$cf` = `$wd/claude-farmer` (metadata directory)

## Expected Working Directory Structure

```
$wd/
├── claude-farmer/
│   ├── GOAL.md       # Human-written spec (AI must not edit this file)
│   └── docs/         # AI-generated outputs
└── ...               # Source code, tests, configs, etc.
```

## Tasks (Internal)

Tasks are internal building blocks. Do not expose them outside this module. Please make sure the prompt inside claude/prompts are accurate.

| Task | Inputs | Outputs |
|------|--------|---------|
| **Review** | GOAL.md, source code | `$cf/docs/REVIEW.md` |
| **Develop** | GOAL.md, REVIEW.md, source code | Code edits in `$wd`, `$cf/docs/DEVELOP.json`  |

### Review Task

1. Reads GOAL.md to understand what the codebase should achieve
2. Reads source code to understand current state
3. Researches best practices via web search
4. Produces `REVIEW.md`
5. Also include a section in `REVIEW.md` about what's unclear in the `GOAL.md`

The REVIEW.md should be like:
```
# Review

## Summary
One-line assessment.

## Goal Alignment
- [x] Goal 1
- [ ] Goal 2: missing X

## Bugs
### High Priority
1. ...

### Medium Priority
1. ...

## Clarifications Needed
1. ... (What's unclear in the GOAL.md?)

## Suggested Improvements

### High Priority
1. ...

### Medium Priority
1. ...

## Next Steps
1. ...
```


### Develop Task

1. Reads GOAL.md to understand what the codebase should achieve
2. Reads REVIEW.md for improvement suggestions
3. Reads source code
4. Implements the suggestions from REVIEW.md
5. Generate an additional DEVELOP.json to dump the file edits

## Exposed API

Only expose the `patch()` method. Do not expose tasks or any other functions.

### patch(options)

**Options:**
- `once: boolean` - Run single iteration (default: false, loops forever)
- `ultrathink: boolean` - Enable ultrathink mode (default: false)

**Workflow per iteration:**
1. Run Review task
2. Run Develop task
3. Commit changes with meaningful message

**Looping behavior:**
- Default: Loop forever until user stops (Ctrl+C)
- **Never terminate automatically**, even if no improvements found
- When no improvements found: exponential backoff sleep (1 min → 2 min → 4 min → ... → max 2 hours)

### develop(options)
**Options:**
- `once: boolean` - Run single iteration (default: true)
- `ultrathink: boolean` - Enable ultrathink mode (default: false)

**Workflow per iteration:**
1. Run Develop task

**Looping behavior:**
- If `once: false`, loop forever until user stops (Ctrl+C)
    - When no improvements found: exponential backoff sleep (1 min → 2 min → 4 min → ... → max 2 hours)

## AI Backend

- Implementation lives in `claude/` subdirectory
- Currently: Claude Code headless mode
- Future: Other AI backends may be added

## Logging

- Log each iteration to `$cf/logs/YYYYMMDD_HHmmss.log`. Where the datetime should operating system time
- Log message also should use operating system time.
- Please make sure the log file name is correct.
- Keep only last 30 log files
- Stream logs in real-time (no buffering)
- Use a logging library (do not implement custom logging)
- Use a library for log rotation (do not implement custom rotation)

## Error Handling: Rate Limits

When Claude returns errors containing "Spending cap reached" or "You've hit your limit":
- Use exponential backoff: 1 min → 2 min → 4 min → 8 min → ... → max 2 hours
- Do not terminate

## Code Organization

- Helpers and utilities go in `utils/` subdirectory

## Dependencies

This is a module within the larger claude-farmer project.
- Install dependencies at project root, not in this module
- Do not modify other files at project root