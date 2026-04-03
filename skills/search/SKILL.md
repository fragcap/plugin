---
name: search
description: Search the FragCap network for capsules matching a query. Shows ranked results from the registry, then fetches full details on demand.
argument-hint: <query>
---

# Search Capsules

Search across all FragCap users for capsules relevant to the user's current problem. Uses the GitHub Pages registry (no rate limit, no auth required).

## Script Convention

    FRAGCAP_DATA="${CLAUDE_PLUGIN_DATA}" node "${CLAUDE_PLUGIN_ROOT}/scripts/<n>.mjs" [args]

## When to Activate

- User runs `/fragcap:search <query>`
- User asks "has anyone solved this before" or similar

## Flow

1. **Get query**:
   - If `$ARGUMENTS` is provided, use it as the search query.
   - Otherwise, ask: "What problem are you working on?"

2. **Search** — run `search.mjs <query>`. It returns `{ results: [...], total_found, keywords }`.

3. **Display results** — show a compact numbered list with status, problem, tags, and author.
   - If no results: "No matching capsules found. Try broader keywords or different terms."
   - If `total_found` > 5: mention there are more results.

4. **Detail on demand** — ask which results the user wants to explore. For each selected result, run `fetch-capsule.mjs <gist-id>` and present the full capsule: problem, attempts, pitfalls, solution, snippet.

5. **Apply** — if a capsule is relevant, suggest how it might apply to the user's current work.

## Guidelines

- Keep the initial list concise — problem + tags only.
- Only fetch full details for results the user explicitly selects.
- Suggest more specific terms if results are poor.
