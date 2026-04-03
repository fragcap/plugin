#!/usr/bin/env node
// Usage: echo '<json>' | node generate-capsule.mjs
// Accepts capsule JSON on stdin (preferred) or as argv[2] for backwards compatibility
import { CAPSULES_DIR, DATA_DIR, output } from './lib/config.mjs';
import { randomUUID } from 'crypto';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';

// Prefer stdin to avoid shell quoting issues with special characters
let raw = process.argv[2];
if (!raw && !process.stdin.isTTY) {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const stdinData = Buffer.concat(chunks).toString('utf8').trim();
    if (stdinData) raw = stdinData;
  } catch { raw = null; }
}
if (!raw) { output({ error: 'Usage: echo \'{"tags":[...],"problem":"...","status":"resolved"}\' | generate-capsule.mjs' }); process.exit(1); }

try {
  const input = JSON.parse(raw);
  await mkdir(CAPSULES_DIR, { recursive: true });

  const now = new Date().toISOString();
  const rawTag = (input.tags?.[0] || 'exploration').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').slice(0, 40);
  const slug = rawTag + '-' + now.slice(0, 7).replace('-', '');
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
