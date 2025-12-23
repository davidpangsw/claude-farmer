# Core Feature

Tools to generate and improve code within any working directory.

## Notation

- `$wd` = working directory (the directory the farmer operates on)
- `$cf` = `$wd/claude-farmer` (farmer metadata directory)

## Working Directory Structure

The farmer expects this structure in the working directory:

```
<working_directory>/
├── claude-farmer/
│   ├── GOAL.md       # Human-written specification (do not let AI edit)
│   └── docs/         # Auto-generated markdown files
└── ...               # Source code, tests, etc.
```

## Tasks

Each task reads context and produces output. Tasks are defined with a `PROMPT.md`.

| Task | Reads | Produces |
|------|-------|----------|
| **Review** | GOAL, source code | `$cf/docs/REVIEW.md` |
| **Develop** | GOAL, REVIEW (if exists), source code | Code edits in `$wd` |

### Task Details

- **Review**: Researches best practices via web search, then generates improvement suggestions
- **Develop**: Implements GOAL requirements, addresses REVIEW feedback

Tasks are not exposed outside of the feature.

## Command

Tasks are building blocks orchestrated into commands.

### Patch Command

Usage: `claude-farmer patch [working_directory] [options]`

Options:
- `--once` - Run once instead of looping

Workflow:
1. Perform **Review**
2. Perform **Develop**
3. Commit with meaningful message

Default: Loop forever for iterative improvement until user stops it.
- If no more improvement could be found, never terminate itself. Sleep for 1 minute, 2 minute, 4 minute, 8 minutes ..., (maxed at 24 hour.)

## AI Integration

- Implementation in `claude/`
- Currently: Claude Code headless mode
  - `ultrathink` is disabled by default, but could be enabled if user indicates.
- Future: Other AI backends

## Output Guidelines

All AI output must be:
- Concise and precise
- No redundant information
- Actionable

## Logging
- Each iteration should be logged in `claude-farmer/logs/YYYYMMDD_HHmmss.log`
  - Only keep last 100 iterations' log
- Be careful. Do not buffer and delay the logging. We don't want the log only appears after the whole process is done.
- Any logging **MUST BE** delivered to log file **IN REAL TIME**. That user can know the progress.