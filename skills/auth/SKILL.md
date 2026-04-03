---
name: auth
description: Authenticate with GitHub via Device Flow — browser-based, no token copy-paste.
---

# FragCap Authentication

Authenticate the user with GitHub using the App Device Flow. The entire flow happens in the browser — never ask the user to create or paste a token.

## Script Convention

All FragCap scripts output JSON to stdout and need the data directory. Run them as:

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs" [args]

On Windows/PowerShell, use `$env:FRAGCAP_DATA="..."` syntax instead.

If a script exits with a non-zero code or returns `{ error: "..." }`, **stop immediately and surface the error to the user**. Never silently retry with a different command or skip the step.

## When to Activate

- User runs `/fragcap:auth`
- Another skill reports "not authenticated"

## Flow

1. **Check existing auth** — run: `FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/auth-status.mjs"`
   - If `authenticated: true` and not expired: tell the user they are already logged in as `@{username}` and stop.
   - If expired with refresh token available: inform the user their token will auto-refresh on next API call — no action needed.
   - Otherwise: proceed to step 2.

2. **Start Device Flow** — run: `FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/auth-start.mjs"`
   - This returns **immediately** with `verification_uri` and `user_code`.
   - Display them clearly to the user:
   ```
   Please visit: {verification_uri}
   Enter the code: {user_code}

   Waiting for authorization...
   ```

3. **Poll for completion** — run: `FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/auth-poll.mjs"` repeatedly.
   - Each call is a **single poll attempt** that returns immediately.
   - If `pending: true`, wait a few seconds and call again.
   - Continue until `success: true` or the code expires.

4. **Handle result**:
   - `success: true` — confirm: "Authenticated as @{username}. You can now use /fragcap:push, /fragcap:list, and other commands."
   - `success: false` with `error` — show the error message. If timeout or code expired, suggest running `/fragcap:auth` again.

## Important

- FragCap only requests **Gist read/write** permission — no repo access.
- The user token stays on their machine; it is never sent to any server other than `api.github.com`.
- Access token auto-expires in 8 hours; refresh token (valid 6 months) auto-refreshes it on next API call.
