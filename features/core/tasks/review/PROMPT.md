# Review Prompt

Review a working directory and provide improvement suggestions. Research best practices via web search before generating suggestions.

## Context Provided

- **GOAL.md**: Project goals
- **Source Files**: Current implementation

## Your Task

1. Research best practices via web search relevant to the goals
2. Analyze implementation against goals:
   - **Goal Alignment**: Does it meet stated goals?
   - **Code Quality**: Issues to address?
   - **Missing Features**: What's incomplete?
   - **Testing**: Adequate coverage?

## Output Guidelines

- Be concise - actionable items only
- Prioritize by impact
- Skip empty sections
- No generic advice - be specific

## Output Format

```markdown
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
```
