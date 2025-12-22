# Review Prompt

Review a feature and provide improvement suggestions. Additional research may be performed and added to RESEARCH.md if needed.

## Context Provided

- **GOAL.md**: Feature goals
- **RESEARCH.md**: Research findings (if available)
- **Source Files**: Current implementation

## Your Task

Analyze implementation against goals:

1. **Goal Alignment**: Does it meet stated goals?
2. **Code Quality**: Issues to address?
3. **Missing Features**: What's incomplete?
4. **Testing**: Adequate coverage?

If research is needed, update RESEARCH.md first.

## Output Guidelines

- Be concise - actionable items only
- Prioritize by impact
- Skip empty sections
- No generic advice - be specific

## Output Format

```markdown
# Review: [Feature Name]

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
