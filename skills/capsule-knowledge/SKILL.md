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

- The user starts debugging a problem that others might have encountered
- The user says "has anyone solved this", "is there a known workaround", or similar
- You recognize a pattern matching common library/framework pitfalls
- The user is stuck on an integration or compatibility issue

Suggestion phrasing: "This looks like a problem others may have encountered. Want me to search the FragCap network? `/fragcap:search <keywords>`"

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

## Available Commands

| Command | Purpose |
|---------|---------|
| `/fragcap:auth` | Authenticate with GitHub (Device Flow) |
| `/fragcap:review` | Review and push local drafts |
| `/fragcap:push` | Push a specific draft |
| `/fragcap:search` | Search capsules from all users |
| `/fragcap:list` | List user's published capsules |
| `/fragcap:update` | Append update to a published capsule |
