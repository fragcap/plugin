---
name: capsule-knowledge
description: Proactive guidance for when and how to suggest FragCap capsule commands. Loaded automatically during FragCap plugin sessions.
---

# FragCap Capsule Knowledge

The FragCap plugin is available in this session.

## When to Proactively Search Capsules

**Trigger a `/fragcap:search` when the user's message implies they want to know about others' experiences.** This includes (but is not limited to):

- "has anyone else encountered this"
- "has anyone had the same experience"
- "how did others solve this"
- "anyone with a similar experience"
- "am I the only one hitting this"
- "has anyone hit this pitfall before"
- Any phrasing — in any language — that asks whether **other people** have faced, solved, or documented a similar problem

When triggered, extract the core technical problem from the conversation context and use it as the search query for `/fragcap:search`. Present the results naturally — e.g., "I found some capsules from other developers who hit similar issues."

## When to Suggest Creating a Capsule

After the user resolves a non-trivial problem, you may **suggest** (not auto-create) drafting a capsule if the solution meets the quality criteria below. Never push without the user's explicit approval.

## **⚠️ Language Requirement: All capsules MUST be written in English — including problem, solution, pitfalls, attempts, tags, and update notes. Even if the user's conversation is in another language, always generate and push capsule content in English.**

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

**`/fragcap:update` does NOT support changing the visibility field.** It can only append notes and change status (open/resolved/abandoned). Visibility is a GitHub Gist property that cannot be toggled after creation.

To change a capsule from public to secret (or vice versa):

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
