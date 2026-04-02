---
name: search
description: Search the FragCap network for capsules matching a query. Shows ranked results from GitHub Pages registry, then fetches full details on demand.
argument-hint: <query>
---

# Search Capsules

Search across all FragCap users for capsules relevant to the user's current problem. Uses the GitHub Pages registry (no rate limit, no auth required).

## When to Activate

- User runs `/fragcap:search <query>`
- User asks "has anyone solved this before" or similar

## Flow

1. **Get query**:
   - If `$ARGUMENTS` is provided, use it as the search query.
   - Otherwise, ask: "What problem are you working on?"

2. **Search** — call `search_capsules(query)`.

3. **Display results** — show a compact numbered list:

   ```
   Found 3 relevant capsules:

   1. [resolved] Parse sheet music structure with an LLM
      Tags: musicxml, music21, llm-parsing | Author: gh:anonymous-a7f3

   2. [open] Connection pool exhaustion under load
      Tags: postgres, pgbouncer | Author: gh:anonymous-b2e1

   3. [resolved] MusicXML namespace handling in Python
      Tags: musicxml, lxml, namespace | Author: gh:username123
   ```

   - If no results: "No matching capsules found. Try broader keywords or different terms."
   - If `total_found` > 5: mention there are more results.

4. **Detail on demand** — ask which results the user wants to explore. For each selected result, call `fetch_capsule(gist_id)` and present:

   ```
   --- Capsule: musicxml-llm-parsing-202604-a7f3 ---
   Problem: Parse sheet music structure with an LLM
   Status: resolved

   Attempts:
   - Feed raw score text to model -> Structure collapsed

   Pitfalls:
   - GPT-4 Vision on sheet music: hallucinations too severe

   Solution: Convert AST to MusicXML first

   Snippet: (if available)
   ```

5. **Apply** — if a capsule is relevant, suggest how it might apply to the user's current work. Ask if they want to incorporate the findings.

## Guidelines

- Keep the initial list concise — problem + tags only.
- Only fetch full details for results the user explicitly selects.
- The search uses keyword + bigram matching; suggest more specific terms if results are poor.
- Results are ranked by relevance score, then `resolved` capsules before `open`/`abandoned`, then by last update time.
