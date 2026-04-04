---
name: list
description: List the user's published FragCap capsules on GitHub Gist — shows ID, status, tags, and Gist URL.
---

# List Published Capsules

Show the user all capsules (SKILL.md files) they have pushed to GitHub Gist.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

If a script exits with a non-zero code or returns `{ error: "..." }`, **stop immediately and surface the error to the user**. Never silently retry with a different command or skip the step.

## When to Activate

- User runs `/fragcap:list`
- User asks what capsules they have published

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → direct to `/fragcap:auth` and stop.
2. **Fetch list** — run `list-gists.mjs`. It returns `{ capsules: [...] }`.
3. **Display** — present as a table with description, status, updated_at, and URL.
4. **Empty state** — if no capsules: "No published capsules yet. Use `/fragcap:review` to review local drafts and push them."
5. **Next actions** — mention `/fragcap:update <gist-id>`, `/fragcap:search`, and `/fragcap:install <gist-id>`.

## Error Handling

- If `list-gists.mjs` fails: show the error message and stop. Do not attempt an alternative approach silently.
