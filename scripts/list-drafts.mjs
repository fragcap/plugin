#!/usr/bin/env node
import { CAPSULES_DIR, output, parseFrontmatter, extractSection } from './lib/config.mjs';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const files = await readdir(CAPSULES_DIR).catch(() => []);
if (files.length === 0) { output({ capsules: [], message: 'No local drafts.' }); process.exit(0); }

const capsules = [];
for (const f of files.filter(f => f.endsWith('.md'))) {
  try {
    const content = await readFile(join(CAPSULES_DIR, f), 'utf8');
    const { meta, body } = parseFrontmatter(content);
    if (!meta.id) continue;
    capsules.push({
      id: meta.id,
      status: meta.status || 'open',
      problem: (meta.description || '').replace(/\\"/g, '"'),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      solution: extractSection(body, 'Fix') || null,
      snippet: extractSection(body, 'Snippet') || null,
      created_at: meta.created_at,
    });
  } catch { continue; }
}
output({ capsules });
