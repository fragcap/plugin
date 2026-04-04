---
name: capsule-knowledge
description: Proactive guidance for when and how to suggest FragCap capsule commands. Loaded automatically during exploration and debugging sessions.
---

# FragCap Capsule Knowledge

The FragCap plugin is available in this session. Use this knowledge to proactively help the user leverage it.

## When to Suggest `/fragcap:review`

- A SessionStart message mentions pending capsule drafts
- The user just finished solving a non-trivial problem in the previous session
- The user asks "what did I explore recently" or similar

Suggestion phrasing: "You have pending capsule drafts from previous sessions. Run `/fragcap:review` to review and share them."

## When to Suggest `/fragcap:search`

When you notice any of these signals:
- The user starts debugging a problem that others might have encountered
- The user says "has anyone solved this", "is there a known workaround", or similar
- You recognize a pattern matching common library/framework pitfalls
- The user is stuck on an integration or compatibility issue

**Do NOT suggest immediately.** Instead, run a silent background search first:

1. Extract 2–4 keywords from the problem (tech terms, error names, library names)
2. Run: `FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/search.mjs" <keywords>`
3. Check the result:
   - If `results` is empty or `total_found` is 0 → **say nothing**, continue helping normally
   - If results exist → surface them proactively:

Suggestion phrasing (only when results exist):
"Found some relevant capsules from the FragCap network that might help:"
Then show the top 1–3 results: problem summary, status, and tags.
Do not ask the user if they want to search — just show what was found.

## What Makes a Good Capsule

- A specific, non-obvious problem with a clear resolution path
- Pitfalls that cost significant debugging time
- Workarounds for library or framework limitations
- Integration patterns between tools that are not well-documented
- Solutions where the root cause was surprising or counter-intuitive

## What Does NOT Need a Capsule

- Trivial syntax fixes or typo corrections
- Well-documented standard procedures (e.g., "how to install X")
- One-line configuration changes
- Problems caused by stale dependencies (just update them)

## Changing Capsule Visibility (Public ↔ Secret)

GitHub Gists cannot toggle visibility after creation. To change a capsule from public to secret (or vice versa):

1. Note the capsule ID: `/fragcap:list` to find it
2. Read/remember the capsule content (it will be shown during deletion)
3. Delete the original: `/fragcap:delete <id>`
4. Re-create with the desired visibility: draft a new capsule with the same content, then `/fragcap:push` — during push you will be asked to choose public or secret scope

Suggestion phrasing: "Gist visibility can't be changed after creation. I can delete the current capsule and re-push it as [public/secret] — the content will be preserved."

## Available Commands

| Command | Purpose |
|---------|---------|
| `/fragcap:auth` | Authenticate with GitHub (Device Flow) |
| `/fragcap:review` | Review and push local drafts |
| `/fragcap:push` | Push a specific draft |
| `/fragcap:search` | Search capsules from all users |
| `/fragcap:list` | List user's published capsules |
| `/fragcap:update` | Append update to a published capsule |
| `/fragcap:delete` | Delete a published capsule |
