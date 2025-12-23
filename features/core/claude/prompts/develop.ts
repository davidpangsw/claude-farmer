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

## Guidelines

- Minimal, focused changes
- Clean, readable code
- Error handling where needed
- JSDoc for public APIs only

## Output

Return JSON array of file edits:
\`\`\`json
[{"path": "...", "content": "..."}]
\`\`\``;
