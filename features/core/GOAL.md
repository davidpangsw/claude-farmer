# Core Feature

Tools to generate and improve code for any feature.

## Notation

- `$f` = `/features/<feature_name>`

## Tasks

Each task reads context and produces output. Tasks are in `$f/tasks/<task_name>/` with a `PROMPT.md`.

| Task | Reads | Produces |
|------|-------|----------|
| **Research** | GOAL, source code | `$f/docs/RESEARCH.md` |
| **Review** | GOAL, RESEARCH, source code | `$f/docs/REVIEW.md` |
| **Develop** | GOAL, REVIEW (if exists), source code | Code edits |
| **Summary** | GOAL, RESEARCH, source code | `$f/SUMMARY/` |

### Task Details

- **Research**: Web search for best practices, libraries, and patterns
- **Review**: Improvement suggestions; may add to RESEARCH.md if needed
- **Develop**: Implement GOAL, address REVIEW feedback
- **Summary**: Human-readable docs + PlantUML (sequence/ERD/others) when useful

Tasks are not exposed outside of the feature.

## Command
- Task are as building blocks to be orchestrated into commands
- Commands should be places under `$f/commands`
  - **Patch**:
    - Execute `$f/scripts/git-patch-checkout.sh`, which would:
      - Read the git tag to get the `major.minor.patch` version of the feature. If not exist, it is `0.0.0`
      - Increment the patch version, that would be our new version. For example, if old version is `1.0.99`, then the patch version is `99`, incremented to `100`. The new version would be `1.0.100`
      - git checkout a new subfeature branch from feature branch,
        - the subfeature branch should be like `features/<feature_name>/v<major>.<minor>.<patch>` where `<patch>` is the new patch version
    - Perform **Review**
    - Perform **Develop**
    - Execute `$f/scripts/git-patch-complete.sh`, which would:
      - Git commit
      - merge back to the feature branch
      - Tag the new version

- Default: Loop mode for iterative improvement
- Optional: Run once with `--once` flag
- Commands are exposed outside of the feature.

## AI Integration

- Implementation in `claude/`
- Currently: Claude Code headless mode
- Future: Other AI backends

## Output Guidelines

All AI output must be:
- Concise and precise
- No redundant information
- Actionable
