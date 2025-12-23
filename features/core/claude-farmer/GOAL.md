# Core Feature

This is a feature folder (or module) of a project, claude-farmer.

Provide methods or classes to generate and improve code within any working directory.

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

Tasks are not exposed outside of the feature. Do not expose any tasks nor its arguments or returns.

## Command

Tasks are building blocks orchestrated into commands. Only implement and expose the command and flags specified in these section. Don't implement or expose any additional commands or flags.

### patch() method
Options:
- `once` - Run once instead of looping
- `ultrathink` - ultrathink mode, default to be false

Workflow:
1. Perform **Review**
2. Perform **Develop**
3. Commit with meaningful message

Default: Loop forever for iterative improvement until user stops it.

- **Do not stop if no more changes needed.**
   - If no more improvement could be found, never terminate itself. Sleep for 1 minute, 2 minute, 4 minute, 8 minutes ..., (maxed at 24 hour.)
- Again,  **Do not stop if no more changes needed.**

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
- Do not use your own logger, use a damn library

## helpers and utilties
- Place your helpers and utilities under utils/