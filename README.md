# FragCap

**Dead sessions, living ideas.**

Most explorations die with the session. FragCap captures them as structured capsules — the problem, the dead ends, the open threads — and makes them searchable by anyone starting something similar. Your unfinished thinking becomes their shortcut.

## What is a capsule?

A capsule is a SKILL.md file — a markdown document with YAML frontmatter that Claude Code can load directly as a skill:

```markdown
---
id: pgbouncer-pool-202604-a0457d5f
description: "Connection pool exhaustion under load with PgBouncer"
tags: ["postgres", "pgbouncer", "connection-pool"]
status: resolved
visibility: anonymous
author: "gh:anonymous-1368de02"
created_at: 2026-04-04T12:00:00.000Z
updated_at: 2026-04-04T12:00:00.000Z
---

# Pgbouncer

## When to Activate

Use this capsule when encountering: Connection pool exhaustion under load with PgBouncer

## Problem

Connection pool exhaustion under load with PgBouncer in production.

## What Does NOT Work

- **Increased pool_size to 200** — Delayed but didn't fix
- **Switched to transaction pooling mode** — Broke prepared statements

## Pitfalls

- PgBouncer silently drops idle connections after server_idle_timeout

## Fix

Set server_idle_timeout=0 and use client-side keepalive instead.
```

Not a blog post. Not documentation. Just the trail you wish someone had left before you — in a format Claude can directly use.

## Install

From the marketplace:
```
/plugin marketplace add fragcap/marketplace
/plugin install fragcap@fragcap-marketplace
```

For local development:
```
claude --plugin-dir ./path/to/fragcap
```

**Zero dependencies.** No `npm install` required, no MCP server, no build step. All scripts use Node.js built-in modules only. Works on macOS, Linux, and Windows.

## Quick Start

### Capsule Generation

```
Turn this session into a capsule draft and let me review it.
```

FragCap structures your exploration into a SKILL.md draft and walks you through review and publishing — authentication is handled inline if needed.

### Capsule Search & Install

```
Check if anyone else has run into a similar issue.
```

Found something useful? Install it as a local skill:

```
/fragcap:install <gist-id>
```

The capsule is saved to `.claude/skills/` and Claude Code will automatically load it in future sessions.

## Skills

| Skill | Description |
|---------|-------------|
| `/fragcap:auth` | Authenticate with GitHub via browser-based Device Flow |
| `/fragcap:review` | Walk through pending drafts one by one — push, skip, or delete each |
| `/fragcap:push [id]` | Push a specific draft to GitHub Gist |
| `/fragcap:search <query>` | Search capsules from all FragCap users |
| `/fragcap:install <gist-id>` | Install a capsule as a local skill in `.claude/skills/` |
| `/fragcap:list` | List your published capsules |
| `/fragcap:update [gist-id]` | Append a follow-up finding to a published capsule |
| `/fragcap:delete [gist-id]` | Permanently delete a published capsule from GitHub Gist |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Session                           │
│                                                             │
│   You debug, explore, build — business as usual             │
│                                                             │
├──────────────────────── Create a Capsule ───────────────────┤
│                                                             │
│   Ask Claude to turn the session into a capsule draft       │
│   Draft is saved as a SKILL.md file locally                 │
│                                                             │
├──────────────────────── Next SessionStart ──────────────────┤
│                                                             │
│   "You have 2 pending capsule draft(s)."                    │
│   /fragcap:review → push / skip / delete each               │
│                                                             │
├──────────────────────── Push ───────────────────────────────┤
│                                                             │
│   Draft → GitHub Gist (SKILL.md, public or secret)          │
│         → Central registry (GitHub Pages, searchable)       │
│                                                             │
├──────────────────────── Discovery & Install ────────────────┤
│                                                             │
│   /fragcap:search "my problem"                              │
│   → Finds capsules from all users via the registry          │
│   /fragcap:install <gist-id>                                │
│   → Installs SKILL.md to .claude/skills/ for auto-loading   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Privacy & Security

**Anonymous by default.** When you push a capsule, you choose:
- `anonymous` — your GitHub username is replaced with a hash, file paths and emails are auto-stripped
- `attributed` — published with your GitHub username, content as-is

**PII detection.** Before pushing, FragCap scans drafts for:
- OS usernames in file paths (`/Users/yourname/...`, `/home/yourname/...`, WSL paths)
- Email addresses
- Internal/corporate URLs
- Private network IP addresses (10.x, 172.16–31.x, 192.168.x)
- Internal hostnames (`.local`, `.internal`, `.corp`, `.lan`)
- Common API key patterns (OpenAI, AWS, GitHub, Slack tokens)

**Minimal permissions.** The GitHub OAuth app requests only Gist read/write scope — no access to your repositories, profile, or organizations.

**Local storage.** Drafts, auth tokens, and cache live in your Claude Code plugin data directory (`~/.claude/plugins/data/fragcap/`). Nothing is sent anywhere until you explicitly push.

## Architecture

```
fragcap/
├── .claude-plugin/plugin.json    # Plugin identity
├── hooks/hooks.json              # SessionStart (pending draft check)
├── scripts/
│   ├── lib/
│   │   ├── config.mjs            # Constants, paths, token management, frontmatter parser
│   │   ├── github.mjs            # GitHub API wrapper (via proxyFetch)
│   │   └── pii.mjs               # PII detection and stripping (JSON + markdown)
│   ├── auth-start.mjs            # Device Flow initiation
│   ├── auth-poll.mjs             # Device Flow polling
│   ├── auth-status.mjs           # Auth state check
│   ├── generate-capsule.mjs      # Write capsule draft as SKILL.md
│   ├── list-drafts.mjs           # List local SKILL.md drafts
│   ├── preview-pii.mjs           # Scan draft for PII
│   ├── delete-draft.mjs          # Delete a local draft
│   ├── push.mjs                  # Push SKILL.md to Gist + register
│   ├── install-capsule.mjs       # Install capsule to .claude/skills/
│   ├── list-gists.mjs            # List pushed capsules (paginated)
│   ├── fetch-capsule.mjs         # Fetch a capsule from Gist
│   ├── update.mjs                # Append update to a capsule
│   ├── delete-gist.mjs           # Delete a published capsule
│   ├── search.mjs                # Search the registry
│   └── check-pending.mjs         # Check for pending drafts
└── skills/
    ├── auth/SKILL.md
    ├── review/SKILL.md
    ├── push/SKILL.md
    ├── search/SKILL.md
    ├── install/SKILL.md
    ├── list/SKILL.md
    ├── update/SKILL.md
    ├── delete/SKILL.md
    └── capsule-knowledge/SKILL.md
```

**Design decisions:**

- **Capsules are SKILL.md files.** Each capsule is a markdown document with YAML frontmatter that Claude Code can load directly as a skill. When installed to `.claude/skills/`, Claude automatically has the captured knowledge available in context — no search needed.
- **No MCP server.** Skills instruct Claude to run `.mjs` scripts via Bash. This eliminates npm dependencies, bootstrap timing issues, and the need for a long-running server process.
- **No npm dependencies.** GitHub API calls use a custom `proxyFetch` built on Node `http`/`https` modules with automatic proxy support. Auth token management, PII stripping, and registry search are all implemented with Node built-in modules (`fs`, `path`, `crypto`). Zero `node_modules`.
- **Cross-platform.** All scripts are `.mjs` files invoked as `node script.mjs`. Works identically on macOS, Linux, and Windows.
- **Skills as orchestrators.** Each skill is a playbook that tells Claude what scripts to run, in what order, and how to present results. Claude handles the UX; scripts handle the data.

## Ecosystem

FragCap consists of three components:

| Component | Repository | Purpose |
|-----------|-----------|---------|
| **Plugin** (this repo) | [fragcap/plugin](https://github.com/fragcap/plugin) | Claude Code plugin — capture, review, push, search, install |
| **Marketplace** | [fragcap/marketplace](https://github.com/fragcap/marketplace) | Plugin catalog entry for the Claude Code marketplace |
| **Worker** | [fragcap/fragcap-worker](https://github.com/fragcap/fragcap-worker) | Cloudflare Worker — registers Gist IDs in the central index |
| **Registry** | [fragcap/registry](https://github.com/fragcap/registry) | GitHub Pages — serves the searchable capsule index |

## FAQ

**Does it capture sessions automatically?**
No. Capsule drafts are only created when you explicitly ask Claude to generate one, or by using the capsule commands directly.

**Can I edit a draft before pushing?**
Yes. Drafts are SKILL.md files in `~/.claude/plugins/data/fragcap/capsules/`. Edit them with any text editor, or ask Claude to modify them during `/fragcap:review`.

**What if I push something I shouldn't have?**
Run `/fragcap:delete <gist-id>` to permanently remove it. Note that the central search index may take up to 24 hours to reflect the deletion.

**Does search require authentication?**
No. The registry is served from GitHub Pages — no auth, no rate limit.

**How do I install a capsule I found?**
Run `/fragcap:install <gist-id>`. The SKILL.md file is saved to `.claude/skills/` in your current project, and Claude Code will automatically load it in future sessions.

**Does it work offline?**
Drafts are saved locally and survive offline sessions. Pushing, searching, and installing require internet access.

## Requirements

- Claude Code (latest version recommended)
- Node.js 18+
- GitHub account (for pushing capsules)

## License

MIT
