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

## AI Integration

- Implementation in `claude/`
- Currently: Claude Code headless mode
- Future: Other AI backends

## Output Guidelines

All AI output must be:
- Concise and precise
- No redundant information
- Actionable
