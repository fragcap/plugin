---
name: list
description: List the user's published FragCap capsules on GitHub Gist — shows ID, status, tags, and Gist URL.
---

# List Published Capsules

Show the user all capsules they have pushed to GitHub Gist.

## When to Activate

- User runs `/fragcap:list`
- User asks what capsules they have published

## Flow

1. **Auth gate** — call `check_auth_status`.
   - Not authenticated: direct to `/fragcap:auth` and stop.

2. **Fetch list** — call `list_pushed_capsules`.

3. **Display** — present as a table:

   ```
   Your capsules (3):

    #  Description                                     Status    Updated      URL
    1  [fragcap][musicxml] Parse sheet music with LLM  resolved  2026-04-02   https://gist.github.com/...
    2  [fragcap][postgres] Connection pool exhaustion   open      2026-03-28   https://gist.github.com/...
    3  [fragcap][react] Hydration mismatch with SSR     resolved  2026-03-15   https://gist.github.com/...
   ```

4. **Empty state** — if no capsules: "No published capsules yet. Use `/fragcap:review` to review local drafts and push them."

5. **Next actions** — after showing the list, mention:
   - `/fragcap:update <gist-id>` to append a follow-up finding
   - `/fragcap:search` to find capsules from other users
