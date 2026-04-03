---
name: delete
description: Permanently delete a published capsule from GitHub Gist and remove it from the local pushed index.
argument-hint: [gist-id]
---

# Delete Published Capsule

Permanently delete a capsule you have pushed to GitHub Gist.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

## When to Activate

- User runs `/fragcap:delete` or `/fragcap:delete <gist-id>`
- User asks to remove or retract a published capsule

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → direct to `/fragcap:auth` and stop.

2. **Select capsule**:
   - If `$ARGUMENTS` is provided, use it as `gist_id`.
   - Otherwise, run `list-gists.mjs` and show a numbered list. Present options inline — user replies with a number:
     ```
     [1] <problem summary>  [2] <problem summary>  ...
     ```

3. **Confirm** — this is irreversible. Present options inline:
   > "Delete `{problem summary}` (`{gist-id}`)? This permanently removes the Gist from GitHub and cannot be undone."
   ```
   [1] Yes, delete  [2] Cancel
   ```
   - If user picks 2 or anything other than 1: stop.

4. **Delete** — run `delete-gist.mjs <gist-id>`.

5. **Result**:
   - Success: "Deleted. The Gist has been removed from GitHub. Note: the central registry index may take up to 24 hours to reflect this — cached search results could still show it temporarily."
   - Error: show the message.

## Note on Registry

FragCap's central registry is a static GitHub Pages index that is updated by the Worker when capsules are pushed. Deletion is not propagated automatically — the entry will age out when the registry is next rebuilt, or the user can open an issue at the registry repository.
