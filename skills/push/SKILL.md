---
name: push
description: Push a specific capsule draft to GitHub Gist and register it in the discovery index. Includes PII preview and visibility choice.
argument-hint: [draft-id]
---

# Push Capsule

Push a single draft capsule to GitHub Gist and register it in the central FragCap registry.

## When to Activate

- User runs `/fragcap:push` or `/fragcap:push <draft-id>`
- User explicitly asks to push a specific draft

## Flow

1. **Auth gate** — call `check_auth_status`.
   - Not authenticated: direct to `/fragcap:auth` and stop.

2. **Select draft**:
   - If `$ARGUMENTS` is provided, use it as the draft ID directly.
   - Otherwise, call `list_local_drafts` and show a numbered list. Ask the user to pick one.
   - If no drafts exist: "No local drafts to push. Drafts are auto-generated after sessions."

3. **PII preview** — call `preview_pii(id)`.
   - Show findings with risk levels and suggested replacements (same format as `/fragcap:review`).
   - If findings exist, let the user confirm they want to proceed.
   - If clean: "No PII detected."

4. **Visibility** — ask the user:
   - `anonymous` (default): author = `gh:anonymous-{hash}`, PII auto-stripped
   - `attributed`: author = `gh:{username}`, content as-is

5. **Push** — call `push_capsule(id, visibility)`.

6. **Result**:
   - Success: show the Gist URL and registry status.
     ```
     Pushed! Gist: https://gist.github.com/...
     Registry: registered
     ```
   - Failure: "Push failed: {error}. Your draft is still saved locally — try again later."
   - Registry failure (non-fatal): "Gist created, but registry sync failed. It will sync on next update."
