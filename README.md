# Claude Farmer

Farm your code with Claude tokens overnight.

## Installation

```bash
git clone https://github.com/davidpangsw/claude-farmer.git
cd claude-farmer
npm install && npm run build
chmod +x ./dist/bin/claude-farmer.js
```

- You can run directly with `./dist/bin/claude-farmer.js`, but it is better to create a symlink (Remember to have your bin in `PATH`):
```bash
ln -s "$(pwd)/dist/bin/claude-farmer.js" ~/.local/bin/claude-farmer

# you may set your path in .zshrc (Or other file depending on your OS)
# if you didn't
export PATH="$PATH:~/.local/bin"`
```

## Usage

### 1. (Optional) Organize your project for optimal farming

If you want to fully utilize Claude Farmer in your project, consider organizing your project like this:

```
project/
├── features/<feature_name>/  # Let farmer use this as working directory
│   └── tests/                # Unit tests for this feature
├── tests/                    # Integration tests that orchestrate features
└── ...                       # build/bin/dist files
```

Each feature is standalone:
- No knowledge about anything outside the feature folder
- All dependencies must be prototyped as interfaces within the folder
- Unit tests are placed inside each feature because Claude Farmer only reads within its working directory
- Note that a feature could still have external dependencies to import.

### 2. Structure your working directory

Claude Farmer works on a single **working directory**. If following section 1's structure, then set your working directory to `project/features/<feature_name>/`. It should contain:

```
<working_directory>/
└── claude-farmer/
    ├── GOAL.md       # Human-written specification (do not let AI edit this)
    └── docs/         # Auto-generated markdown files
```

### 3. Review your git status
The farmer will patch your current branch:
- Make sure no uncommitted changes or untracked files.
- If you don't have a dedicated branch yet, it is highly recommended to create one for Claude Farmer to work on.
  - For example, if you follows section 1's structure, you may use `features/<feature_name>` as `<branch_name>`, and run `git checkout -b <branch_name>`

### 4. Set up your GOAL.md
- You need to set up your `GOAL.md`, create it under `claude-farmer/`.
  - Specify your goal. It could be anything. You may follow the template in `templates/GOAL.md` in this project.


### 5. Let farmer patch your working directory

```bash
claude-farmer patch [working_directory]  # defaults to current directory
```

The `patch` command:
1. Performs **Review** - reads `claude-farmer/GOAL.md`, researches best practices via web search, and generates improvement suggestions to `claude-farmer/docs/REVIEW.md`
2. Performs **Develop** - implements `claude-farmer/GOAL.md` requirements and addresses review feedback by editing source code
3. Commits with a meaningful message

By default, this loops forever for iterative improvement until user stops it. Use `--once` to run a single iteration.

Options:
- `--once` - Run once instead of looping

### 6a. Recovery from failures

If Claude Farmer fails mid-iteration (e.g., network error, insufficient tokens), you can run `patch` again. If it doesn't work, there may be some problem in your git status, go back to step 3.

### 6b. Manual changes on your GOAL.md or other files
- If you want manual changes, like:
  - Installing external dependencies for Claude Farmer to work better
  - Fix your GOAL.md
  - Hint or comment in GOAL.md, source code, or any other files to help Claude Farmer
  - Adding customized files or classes that help Claude Farmer work better

- Steps:
  - Stop the corresponding Claude Farmer instance
  - Make and commit as many changes as you want
  - Run `patch` again (step 5)

### 6c. It works smoothly
- Good to know, go sleep.

### 7. Once you are familiar with the flow, run the farmers in parallel and enjoy your farm! (And watch your tokens burn)