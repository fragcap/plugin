---
name: install
description: Install a capsule from GitHub Gist as a local skill in the current project's .claude/skills/ directory. Once installed, Claude Code loads it automatically.
argument-hint: <gist-id>
---

# Install Capsule

Fetch a published capsule (SKILL.md) from GitHub Gist and install it into the current project so Claude Code loads it automatically in future sessions.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

If a script exits with a non-zero code or returns `{ error: "..." }`, **stop immediately and surface the error to the user**. Never silently retry with a different command or skip the step.

## When to Activate

- User runs `/fragcap:install <gist-id>`
- User asks to install or save a capsule locally
- After viewing search results, user wants to keep a capsule

## Flow

1. **Get gist ID**:
   - If `$ARGUMENTS` is provided, use it as the gist ID.
   - Otherwise, ask: "Which capsule would you like to install? Provide a gist ID or run `/fragcap:search` to find one."

2. **Install** — run `install-capsule.mjs <gist-id>`.

3. **Result**:
   - Success: show the installed path, capsule description, and tags. Explain that Claude Code will automatically load this skill in future sessions within this project.
   - Error: show the error message.

## Notes

- Capsules are installed to `.claude/skills/` in the current working directory.
- Claude Code automatically loads all `.md` files in `.claude/skills/` as context.
- Installing the same capsule again will overwrite the previous version.
- To uninstall, simply delete the `.md` file from `.claude/skills/`.
