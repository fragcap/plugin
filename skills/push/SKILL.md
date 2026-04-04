---
name: push
description: Push a specific capsule draft to GitHub Gist and register it in the discovery index. Includes PII preview and visibility choice.
argument-hint: [draft-id]
---

# Push Capsule

Push a single draft capsule (SKILL.md) to GitHub Gist and register it in the central FragCap registry.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

On Windows/PowerShell, use `$env:FRAGCAP_DATA="..."` syntax instead.

If a script exits with a non-zero code or returns `{ error: "..." }`, **stop immediately and surface the error to the user**. Never silently retry with a different command or skip the step.

## When to Activate

- User runs `/fragcap:push` or `/fragcap:push <draft-id>`
- User explicitly asks to push a specific draft

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → direct to `/fragcap:auth` and stop.

2. **Select draft**:
   - If `$ARGUMENTS` is provided, use it as the draft ID directly.
   - Otherwise, run `list-drafts.mjs` and show a numbered list. Present options inline — user replies with a number:
     ```
     [1] <problem summary>  [2] <problem summary>  ...
     ```
   - If no drafts exist: "No local drafts to push. Ask Claude to generate a capsule draft first."

3. **PII preview** — run `preview-pii.mjs <draft-id>`.
   - Show findings with risk levels and suggested replacements.
   - If findings exist, present a confirmation inline:
     ```
     [1] Proceed anyway  [2] Cancel
     ```
   - If clean: "No PII detected."

4. **Visibility** — present options inline, do not ask the user to type:
   ```
   [1] anonymous (default) — author replaced with hash, PII auto-stripped
   [2] attributed — published with your GitHub username
   ```

5. **Gist scope** — present options inline:
   ```
   [1] public (default) — searchable by others, registered in central index
   [2] secret — unlisted, not registered in index
   ```

6. **Push** — run `push.mjs <draft-id> <visibility> <scope>` where scope is `public` or `secret`.

7. **Result**:
   - Success: show the Gist URL, public/secret status, and registry status. Mention that others can install this capsule with `/fragcap:install <gist-id>`.
   - General failure: "Push failed: {error}. Your draft is still saved locally — try again later."
   - **Public registration failure** (response contains `suggest_secret: true`):
     - The public Gist has already been rolled back (deleted) automatically.
     - Show the `error` and `message` fields from the response.
     - Present inline options:
       ```
       [1] Upload as secret instead  [2] Cancel — keep draft locally
       ```
     - If user picks [1]: re-run `push.mjs <draft-id> <visibility> secret`.
