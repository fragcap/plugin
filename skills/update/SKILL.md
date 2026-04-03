---
name: update
description: Append an update note or change status on a published capsule. Syncs changes to both the Gist and the central registry.
argument-hint: [gist-id]
---

# Update Capsule

Append a follow-up finding, correction, or status change to an already-pushed capsule.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

If a script exits with a non-zero code or returns `{ error: "..." }`, **stop immediately and surface the error to the user**. Never silently retry with a different command or skip the step.

## When to Activate

- User runs `/fragcap:update` or `/fragcap:update <gist-id>`
- User wants to add new information to an existing capsule

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → direct to `/fragcap:auth` and stop.

2. **Select capsule**:
   - If `$ARGUMENTS` is provided, use it as `gist_id`.
   - Otherwise, run `list-gists.mjs` and show a numbered list. Present options inline — user replies with a number:
     ```
     [1] <problem summary>  [2] <problem summary>  ...
     ```

3. **Show current state** — run `fetch-capsule.mjs <gist-id>` and display problem, status, tags, attempts, pitfalls, solution, and previous updates.

4. **Collect update**:
   - **Note**: ask the user "What's the new finding, correction, or follow-up?" (free text, required)
   - **Status change**: present options inline — user replies with a number:
     ```
     [1] keep current  [2] open  [3] resolved  [4] abandoned
     ```

5. **Apply** — run `update.mjs <gist-id> "<note>" [status]`.

6. **Confirm**:
   - Success: "Updated! Status: {status} | Total updates: {n} | Registry: synced"
   - Error: show the message and remind user they can only update their own capsules.
