#!/usr/bin/env node
// Usage: node generate-capsule.mjs '<json>'
// Accepts capsule data as a JSON string argument
import { CAPSULES_DIR, DATA_DIR, output } from './lib/config.mjs';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const raw = process.argv[2];
if (!raw) { output({ error: 'Usage: generate-capsule.mjs \'{"tags":[...],"problem":"...","status":"resolved"}\'' }); process.exit(1); }

try {
  const input = JSON.parse(raw);
  await mkdir(CAPSULES_DIR, { recursive: true });

  const now = new Date().toISOString();
  const slug = (input.tags?.[0] || 'exploration') + '-' + now.slice(0, 7).replace('-', '');
  const id = `${slug}-${randomUUID().slice(0, 8)}`;

  const capsule = {
    schema_version: 1, id,
    tags: input.tags || [], problem: input.problem || '',
    attempts: input.attempts || [], pitfalls: input.pitfalls || [],
    solution: input.solution || null, snippet: input.snippet || null,
    status: input.status || 'resolved',
    created_at: now, updated_at: now,
    visibility: 'anonymous', author: 'gh:anonymous-pending', updates: []
  };

  await writeFile(join(CAPSULES_DIR, `${id}.json`), JSON.stringify(capsule, null, 2));
  await writeFile(join(DATA_DIR, 'pending_review_flag'), String(Date.now()));
  output({ success: true, id });
} catch (e) { output({ error: e.message }); process.exit(1); }
