# FragCap

**Dead sessions, living ideas.**

Most explorations die with the session. FragCap captures them as structured capsules — the problem, the dead ends, the open threads — and makes them searchable by anyone starting something similar. Your unfinished thinking becomes their shortcut.

## What is a capsule?

A capsule is a structured record of an exploration session:

```json
{
  "problem": "Connection pool exhaustion under load with PgBouncer",
  "tags": ["postgres", "pgbouncer", "connection-pool"],
  "attempts": [
    { "tried": "Increased pool_size to 200", "outcome": "Delayed but didn't fix" },
    { "tried": "Switched to transaction pooling mode", "outcome": "Broke prepared statements" }
  ],
  "pitfalls": ["PgBouncer silently drops idle connections after server_idle_timeout"],
  "solution": "Set server_idle_timeout=0 and use client-side keepalive instead",
  "status": "resolved"
}
```

Not a blog post. Not documentation. Just the trail you wish someone had left before you.

## Install

From the marketplace:
```
/plugin marketplace add fragcap/marketplace
/plugin install fragcap@fragcap
```

For local development:
```
claude --plugin-dir ./path/to/fragcap
```

**Zero dependencies.** No `npm install` required, no MCP server, no build step. All scripts use Node.js built-in modules only. Works on macOS, Linux, and Windows.

## Quick Start

**1. Authenticate**

```
/fragcap:auth
```

Opens a browser-based GitHub Device Flow. FragCap only requests Gist read/write permission — no repo access. Your token stays on your machine.

**2. Work normally**

Just use Claude Code as you always do. When your session ends, FragCap automatically evaluates whether it produced actionable knowledge and saves a draft locally.

**3. Review next time**

Next session, you'll see:
```
You have 2 pending capsule draft(s). Run /fragcap:review to review them.
```

Review each draft — push it (anonymously or with your GitHub name), skip it, or delete it.

**4. Search**

Hit a wall? Search what others have learned:
```
/fragcap:search pgbouncer connection pool timeout
```

## Skills

| Skill | Description |
|---------|-------------|
| `/fragcap:auth` | Authenticate with GitHub via browser-based Device Flow |
| `/fragcap:review` | Walk through pending drafts one by one — push, skip, or delete each |
| `/fragcap:push [id]` | Push a specific draft to GitHub Gist |
| `/fragcap:search <query>` | Search capsules from all FragCap users |
| `/fragcap:list` | List your published capsules |
| `/fragcap:update [gist-id]` | Append a follow-up finding to a published capsule |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Session                           │
│                                                             │
│   You debug, explore, build — business as usual             │
│                                                             │
├──────────────────────── SessionEnd ─────────────────────────┤
│                                                             │
│   Agent evaluates: "Was there actionable knowledge?"        │
│   If yes → saves a capsule draft to local disk              │
│   If trivial → does nothing                                 │
│                                                             │
├──────────────────────── Next SessionStart ──────────────────┤
│                                                             │
│   "You have 2 pending capsule draft(s)."                    │
│   /fragcap:review → push / skip / delete each               │
│                                                             │
├──────────────────────── Push ───────────────────────────────┤
│                                                             │
│   Draft → GitHub Gist (public, anonymous or attributed)     │
│         → Central registry (GitHub Pages, searchable)       │
│                                                             │
├──────────────────────── Discovery ──────────────────────────┤
│                                                             │
│   /fragcap:search "my problem"                              │
│   → Finds capsules from all users via the registry          │
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

**Minimal permissions.** The GitHub OAuth app requests only Gist read/write scope — no access to your repositories, profile, or organizations.

**Local storage.** Drafts, auth tokens, and cache live in your Claude Code plugin data directory (`~/.claude/plugins/data/fragcap/`). Nothing is sent anywhere until you explicitly push.

## Architecture

```
fragcap/
├── .claude-plugin/plugin.json    # Plugin identity
├── hooks/hooks.json              # SessionEnd (auto-capture) + SessionStart (pending check)
├── scripts/
│   ├── lib/
│   │   ├── config.mjs            # Constants, paths, token management
│   │   ├── github.mjs            # GitHub API via Node built-in fetch
│   │   └── pii.mjs               # PII detection and stripping
│   ├── auth-start.mjs            # Device Flow initiation
│   ├── auth-poll.mjs             # Device Flow polling
│   ├── auth-status.mjs           # Auth state check
│   ├── generate-capsule.mjs      # Write capsule draft to disk
│   ├── list-drafts.mjs           # List local drafts
│   ├── preview-pii.mjs           # Scan draft for PII
│   ├── delete-draft.mjs          # Delete a draft
│   ├── push.mjs                  # Push to Gist + register
│   ├── list-gists.mjs            # List pushed capsules
│   ├── fetch-capsule.mjs         # Fetch a capsule from Gist
│   ├── update.mjs                # Append update to a capsule
│   ├── search.mjs                # Search the registry
│   └── check-pending.mjs         # Check for pending drafts
└── skills/
    ├── auth/SKILL.md
    ├── review/SKILL.md
    ├── push/SKILL.md
    ├── search/SKILL.md
    ├── list/SKILL.md
    ├── update/SKILL.md
    └── capsule-knowledge/SKILL.md
```

**Design decisions:**

- **No MCP server.** Skills instruct Claude to run `.mjs` scripts via Bash. This eliminates npm dependencies, bootstrap timing issues, and the need for a long-running server process.
- **No npm dependencies.** GitHub API calls use Node 18+ built-in `fetch`. Auth token management, PII stripping, and registry search are all implemented with Node built-in modules (`fs`, `path`, `crypto`). Zero `node_modules`.
- **Cross-platform.** All scripts are `.mjs` files invoked as `node script.mjs`. Works identically on macOS, Linux, and Windows.
- **Skills as orchestrators.** Each skill is a playbook that tells Claude what scripts to run, in what order, and how to present results. Claude handles the UX; scripts handle the data.

## Ecosystem

FragCap consists of three components:

| Component | Repository | Purpose |
|-----------|-----------|---------|
| **Plugin** (this repo) | [fragcap/fragcap](https://github.com/fragcap/fragcap) | Claude Code plugin — capture, review, push, search |
| **Worker** | [fragcap/fragcap-worker](https://github.com/fragcap/fragcap-worker) | Cloudflare Worker — registers Gist IDs in the central index |
| **Registry** | [fragcap/registry](https://github.com/fragcap/registry) | GitHub Pages — serves the searchable capsule index |

## FAQ

**Does it capture every session?**
No. The SessionEnd agent evaluates whether the session contained actionable knowledge — concrete attempts with outcomes, specific pitfalls, or working solutions. Trivial sessions (fewer than 4 meaningful exchanges, no tool use) are skipped.

**Can I edit a draft before pushing?**
Yes. Drafts are plain JSON files in `~/.claude/plugins/data/fragcap/capsules/`. Edit them with any text editor, or ask Claude to modify them during `/fragcap:review`.

**What if I push something I shouldn't have?**
Capsules are stored as public GitHub Gists under your account. Delete them directly from [gist.github.com](https://gist.github.com).

**Does search require authentication?**
No. The registry is served from GitHub Pages — no auth, no rate limit.

**Does it work offline?**
Drafts are saved locally and survive offline sessions. Pushing and searching require internet access.

## Requirements

- Claude Code (latest version recommended)
- Node.js 18+ (for built-in `fetch` support)
- GitHub account (for pushing capsules)

## License

MIT
