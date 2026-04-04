---
name: review
description: Review pending capsule drafts one-by-one — scan for PII, then push, skip, or delete each draft.
---

# Review Capsule Drafts

Guide the user through reviewing locally saved capsule drafts. Drafts are auto-generated at the end of each session.

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

If a script exits with a non-zero code or returns `{ error: "..." }`, **stop immediately and surface the error to the user**. Never silently retry with a different command or skip the step.

## When to Activate

- User runs `/fragcap:review`
- SessionStart hook reports pending drafts
- User asks about their recent explorations

## Flow

1. **Auth gate** — run `auth-status.mjs`. Not authenticated → tell user to run `/fragcap:auth` and stop.

2. **List drafts** — run `list-drafts.mjs`.
   - Empty: "No pending drafts. Drafts are auto-generated when you finish a session that produces actionable findings." Stop.
   - Has drafts: show a numbered summary with ID, problem, tags, status, attempt/pitfall/solution counts.

3. **Review each draft** — process one at a time:

   a. **PII scan** — run `preview-pii.mjs <draft-id>`. Display findings if any. If clean: "No PII detected."

   b. **Ask for decision** — present numbered options inline, do not ask the user to type free text:
   ```
   [1] Push  [2] Skip  [3] Delete
   ```
   - **1 Push** — present visibility options:
     ```
     [1] anonymous (default)  [2] attributed
     ```
     Then present gist scope options:
     ```
     [1] public (default) — searchable by others, registered in central index
     [2] secret — unlisted, not registered in index
     ```
     Then run `push.mjs <draft-id> <visibility> <scope>` where scope is `public` or `secret`.
   - **2 Skip** — keep the draft for later, move to next
   - **3 Delete** — run `delete-draft.mjs <draft-id>` to permanently remove

4. **Summary** — after all drafts are processed:
   ```
   Done! Pushed: 2 | Skipped: 1 | Deleted: 0
   ```

## Error Handling

- If push fails: the draft is still saved locally. Tell the user: "Push failed ({error}). Your draft is safe — try again later."
