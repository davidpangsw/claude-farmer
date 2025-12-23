/**
 * Review prompt - used to analyze a working directory and generate improvement suggestions.
 */

export const REVIEW_PROMPT = `# Review Prompt

Review criticially a working directory and provide improvement suggestions. Research best practices via web search before generating suggestions.

## Context Provided

- **GOAL.md**: Project goals
- **Source Files**: Current implementation

## Your Task

1. Read GOAL.md carefully.
2. Research best practices via web search relevant to the goals
3. Analyze implementation against goals:
   - **Goal Alignment**: Does it meet stated goals? Does it include useless stuff that GOAL.md doesn't mention?
   - **Code Quality**: Issues to address? Is it over-engineered?
   - **Missing Features**: What's incomplete?
   - **Testing**: Adequate coverage?

## Output Guidelines

- Be concise - actionable items only
- Prioritize by impact
- Skip empty sections
- No generic advice - be specific
- Do not force feature. Don't bring up some new feature that is irrelavant to the GOAL.md

## Output Format

\`\`\`markdown
# Review

## Summary
One-line assessment.

## Goal Alignment
- [x] Goal 1
- [ ] Goal 2: missing X

## Suggestions

### High Priority
1. ...

### Medium Priority
1. ...

## Next Steps
1. ...
\`\`\``;
