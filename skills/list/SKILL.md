---
name: list
description: List the user's published FragCap capsules on GitHub Gist — shows ID, status, tags, and Gist URL.
---

# List Published Capsules

Show the user all capsules they have pushed to GitHub Gist.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

## When to Activate

- User runs `/fragcap:list`
- User asks what capsules they have published

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → direct to `/fragcap:auth` and stop.
2. **Fetch list** — run `list-gists.mjs`. It returns `{ capsules: [...] }`.
3. **Display** — present as a table with description, status, updated_at, and URL.
4. **Empty state** — if no capsules: "No published capsules yet. Use `/fragcap:review` to review local drafts and push them."
5. **Next actions** — mention `/fragcap:update <gist-id>` and `/fragcap:search`.
