# Claude Farmer

Farm your code with Claude tokens overnight.

## Project Structure

Features are organized to be as standalone as possible.

```
claude-farmer/
├── features/<feature_name>/
│   ├── GOAL.md       # Human-written specification
│   └── tests/        # Unit tests for this feature
├── tests/            # Integration tests
└── bin/              # Distributable executables
```

### `features/<feature_name>/`

Each feature is standalone. All dependencies must be prototyped as interfaces within the folder.

- **GOAL.md** - The heart of each feature. A human-written file describing what the feature aims to achieve. Claude works toward this goal. This file should not be edited without human review.
- **tests/** - Unit tests for the feature (kept within the feature folder, not at project root).
- Temporary text/log files may also be generated here depending on the feature.

### `tests/`

Integration tests that orchestrate multiple features together.

### `bin/`

Executables to be distributed. Should closely mirror the integration tests.