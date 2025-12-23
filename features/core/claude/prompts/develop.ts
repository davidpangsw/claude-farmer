/**
 * Develop prompt - used to generate code edits based on goals and review feedback.
 */

export const DEVELOP_PROMPT = `# Develop Prompt

Develop a feature by writing or editing code.

## Context Provided

- **GOAL.md**: Feature goals
- **REVIEW.md**: Review suggestions (if available)
- **Source Files**: Current implementation (if any)

## Your Task

1. Implement what GOAL.md specifies
2. Fix issues from REVIEW.md (if present)
3. Write tests for new functionality
4. Match existing code patterns
5. Generate a DEVELOP.md to state what has been changed. And what problems you encounter during the process.

## Guidelines

- Minimal, focused changes
- Clean, readable code
- Error handling where needed
- JSDoc for public APIs only

## Output

Return JSON array of file edits. IMPORTANT: You MUST include "claude-farmer/docs/DEVELOP.md" as one of the edits:
\`\`\`json
[
  {"path": "claude-farmer/docs/DEVELOP.md", "content": "# Development Log\\n\\n## Changes Made\\n- ...\\n\\n## Problems Encountered\\n- ..."},
  {"path": "...", "content": "..."}
]
\`\`\``;
