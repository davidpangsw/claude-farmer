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
│   └── docs/         # Markdown files for AI to read/write
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
- `--trunk <branch>` - Trunk branch to branch from (default: `develop`)
- `--checkout <branch>` - Feature branch to work on (default: `features/<working_directory_name>`)
- `--once` - Run once instead of looping

Workflow:
1. Execute git checkout script:
   - Read git tag to get `major.minor.patch` version (default: `0.0.0`)
   - Increment patch version
   - Checkout new subbranch `<branch_name>/v<major>.<minor>.<patch>`
2. Perform **Review**
3. Perform **Develop**
4. Execute git complete script:
   - Commit changes
   - Merge back to feature branch
   - Tag the new version

Default: Loop mode for iterative improvement.

## AI Integration

- Implementation in `claude/`
- Currently: Claude Code headless mode
- Future: Other AI backends

## Output Guidelines

All AI output must be:
- Concise and precise
- No redundant information
- Actionable
