---
name: update
description: Append an update note or change status on a published capsule. Syncs changes to both the Gist and the central registry.
argument-hint: [gist-id]
---

# Update Capsule

Append a follow-up finding, correction, or status change to an already-pushed capsule.

## When to Activate

- User runs `/fragcap:update` or `/fragcap:update <gist-id>`
- User wants to add new information to an existing capsule

## Flow

1. **Auth gate** — call `check_auth_status`.
   - Not authenticated: direct to `/fragcap:auth` and stop.

2. **Select capsule**:
   - If `$ARGUMENTS` is provided, use it as `gist_id`.
   - Otherwise, call `list_pushed_capsules` to show the user's capsules. Ask them to pick one.
   - If user provides a number, map it to the corresponding gist_id from the list.

3. **Show current state** — call `fetch_capsule(gist_id)` and display:
   - Problem, status, tags
   - Existing attempts and pitfalls
   - Current solution (if any)
   - Previous updates (if any)

4. **Collect update** — ask the user:
   - **Note**: "What's the new finding, correction, or follow-up?" (required)
   - **Status change**: "Change status? (open / resolved / abandoned, or leave unchanged)" (optional)

5. **Apply** — call `update_capsule(gist_id, note, status)`.

6. **Confirm**:
   - Success: "Updated! Status: {status} | Total updates: {n} | Registry: synced"
   - Registry sync failure (non-fatal): "Gist updated, but registry sync failed. It will catch up on next update."
   - Error: show the message. If capsule not found, remind the user they can only update their own pushed capsules.
