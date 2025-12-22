# Summary Prompt

Generate concise, human-readable summary files for `$f/SUMMARY/`.

## Context Provided

- **GOAL.md**: Feature goals
- **RESEARCH.md**: Research findings (if available)
- **Source Files**: Current implementation

## Your Task

Create summary files:

1. **OVERVIEW.md**: Feature purpose and functionality
2. **ARCHITECTURE.md**: Code organization (only if non-trivial)
3. **PlantUML** (only when useful):
   - Sequence diagrams for workflows
   - ERD for data relationships

## Output Guidelines

- Concise - no redundant info
- Bullet points over paragraphs
- Skip diagrams for simple code

## Output Format

```json
[
  {"filename": "OVERVIEW.md", "content": "..."},
  {"filename": "sequence.puml", "content": "@startuml..."}
]
```
