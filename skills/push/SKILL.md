---
name: push
description: Push a specific capsule draft to GitHub Gist and register it in the discovery index. Includes PII preview and visibility choice.
argument-hint: [draft-id]
---

# Push Capsule

Push a single draft capsule to GitHub Gist and register it in the central FragCap registry.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

## When to Activate

- User runs `/fragcap:push` or `/fragcap:push <draft-id>`
- User explicitly asks to push a specific draft

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → direct to `/fragcap:auth` and stop.

2. **Select draft**:
   - If `$ARGUMENTS` is provided, use it as the draft ID directly.
   - Otherwise, run `list-drafts.mjs` and show a numbered list. Ask the user to pick one.
   - If no drafts exist: "No local drafts to push. Drafts are auto-generated after sessions."

3. **PII preview** — run `preview-pii.mjs <draft-id>`.
   - Show findings with risk levels and suggested replacements.
   - If findings exist, let the user confirm they want to proceed.
   - If clean: "No PII detected."

4. **Visibility** — ask the user:
   - `anonymous` (default): author = `gh:anonymous-{hash}`, PII auto-stripped
   - `attributed`: author = `gh:{username}`, content as-is

5. **Gist scope** — ask the user:
   - `public` (default): Gist is public, registered in the central index, searchable by others.
   - `private`: Gist is secret (only accessible via URL), **not** registered — others cannot search for it.

6. **Push** — run `push.mjs <draft-id> <visibility> <scope>` where scope is `public` or `private`.

7. **Result**:
   - Success: show the Gist URL, public/private status, and registry status.
   - Failure: "Push failed: {error}. Your draft is still saved locally — try again later."
