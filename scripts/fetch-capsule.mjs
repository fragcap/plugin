#!/usr/bin/env node
// Usage: node fetch-capsule.mjs <gist-id>
import { AUTH_PATH, readJSON, output, parseFrontmatter, extractSection } from './lib/config.mjs';
import { getGist } from './lib/github.mjs';

const [,, gistId] = process.argv;
if (!gistId) { output({ error: 'Usage: fetch-capsule.mjs <gist-id>' }); process.exit(1); }
if (!/^[a-f0-9]{20,32}$/i.test(gistId)) { output({ error: 'Invalid gist id format.' }); process.exit(1); }

try {
  const auth = await readJSON(AUTH_PATH);
  const { data } = await getGist(gistId, auth?.access_token);
  const file = data.files?.['SKILL.md'];
  if (!file?.content) { output({ error: 'SKILL.md not found in this gist.' }); process.exit(1); }

  const { meta, body } = parseFrontmatter(file.content);
  output({
    capsule: {
      id: meta.id,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      status: meta.status,
      author: meta.author,
      problem: extractSection(body, 'Problem') || meta.description,
      attempts: extractSection(body, 'What Does NOT Work'),
      pitfalls: extractSection(body, 'Pitfalls'),
      solution: extractSection(body, 'Fix'),
      snippet: extractSection(body, 'Snippet'),
      updates: [...body.matchAll(/^## Update \((\d{4}-\d{2}-\d{2})\)\s*\n\n([\s\S]*?)(?=\n## |$)/gm)]
        .map(m => ({ date: m[1], note: m[2].trim() })),
    },
    raw_skill: file.content,
  });
} catch (e) { output({ error: e.message }); process.exit(1); }
