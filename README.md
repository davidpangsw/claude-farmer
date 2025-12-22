# Claude Farmer

Farm your code with Claude tokens overnight.

## Installation

```bash
git clone https://github.com/davidpangsw/claude-farmer.git
cd claude-farmer
npm install && npm run build
```

Then either:
- Run directly: `./bin/claude-farmer.js`
- Add to PATH: `export PATH="$PATH:/path/to/claude-farmer/bin"`

## Usage

### 1. Structure your working directory

A farmer works on a single **working directory**. It should contain:

```
<working_directory>/
└── claude-farmer/
    ├── GOAL.md       # Human-written specification (do not let AI edit this)
    └── docs/         # Markdown files for AI to read/write
```

### 2. (Optional) Organize your project for optimal farming

If you want to fully utilize the farmer, consider organizing your project like this:

```
project/
├── features/<feature_name>/  # Let farmer use this as working directory
│   ├── claude-farmer/
│   │   ├── GOAL.md
│   │   └── docs/
│   └── tests/                # Unit tests for this feature
├── tests/                    # Integration tests that orchestrate features
└── ...                       # build/bin/dist files
```

Each feature is standalone:
- No knowledge about anything outside the feature folder
- All dependencies must be prototyped as interfaces within the folder
- Unit tests are placed inside each feature because the farmer only reads within its working directory

### 3. Ensure clean git status

The farmer checks out a feature branch (called `<branch_name>`, default: `features/<working_directory_name>`) from the trunk branch. Requirements:
- No uncommitted changes or untracked files
- The feature branch either doesn't exist (starts fresh at `v0.0.0`), or has a version tag `v<major>.<minor>.<patch>` on its latest commit

### 4. Run the farmer

```bash
claude-farmer patch [working_directory]
```

The `patch` command:
1. Checks out a new subbranch `<branch_name>/v<major>.<minor>.<patch+1>` from the feature branch
2. Performs **Review** - reads `claude-farmer/GOAL.md`, researches best practices via web search, and generates improvement suggestions to `claude-farmer/docs/REVIEW.md`
3. Performs **Develop** - implements `claude-farmer/GOAL.md` requirements and addresses review feedback by editing source code
4. Commits, merges back to feature branch, and tags the new version

By default, this loops for iterative improvement. Use `--once` to run a single iteration.

Options:
- `--trunk <branch>` - Trunk branch to branch from (default: `develop`)
- `--checkout <branch>` - Feature branch to work on (default: `features/<working_directory_name>`)
- `--once` - Run once instead of looping

### Recovery from failures

If the farmer fails mid-iteration (e.g., network error, insufficient tokens), you can recover:

```bash
# Check the current state
git status
git branch

# Option 1: Discard the failed subbranch and retry
git checkout <branch_name>
git branch -D <branch_name>/v<version>   # delete the failed subbranch
claude-farmer patch [working_directory]

# Option 2: Continue manually from where it left off
git diff                                  # review uncommitted changes
git add . && git commit -m "manual fix"
git checkout <branch_name>
git merge <branch_name>/v<version>
git tag v<version>
```