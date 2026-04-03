---
name: update
description: Append an update note or change status on a published capsule. Syncs changes to both the Gist and the central registry.
argument-hint: [gist-id]
---

# Update Capsule

Append a follow-up finding, correction, or status change to an already-pushed capsule.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

## When to Activate

- User runs `/fragcap:update` or `/fragcap:update <gist-id>`
- User wants to add new information to an existing capsule

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → direct to `/fragcap:auth` and stop.

2. **Select capsule**:
   - If `$ARGUMENTS` is provided, use it as `gist_id`.
   - Otherwise, run `list-gists.mjs` to show the user's capsules. Ask them to pick one.

3. **Show current state** — run `fetch-capsule.mjs <gist-id>` and display problem, status, tags, attempts, pitfalls, solution, and previous updates.

4. **Collect update** — ask the user:
   - **Note**: "What's the new finding, correction, or follow-up?" (required)
   - **Status change**: "Change status? (open / resolved / abandoned, or leave unchanged)" (optional)

5. **Apply** — run `update.mjs <gist-id> "<note>" [status]`.

6. **Confirm**:
   - Success: "Updated! Status: {status} | Total updates: {n} | Registry: synced"
   - Error: show the message and remind user they can only update their own capsules.
