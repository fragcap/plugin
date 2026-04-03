#!/usr/bin/env node
import { CAPSULES_DIR, readJSON, output } from './lib/config.mjs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const files = await readdir(CAPSULES_DIR).catch(() => []);
if (files.length === 0) { output({ capsules: [], message: 'No local drafts.' }); process.exit(0); }

const capsules = [];
for (const f of files.filter(f => f.endsWith('.json'))) {
  const c = await readJSON(join(CAPSULES_DIR, f));
  if (!c) continue;
  capsules.push({ id: c.id, status: c.status, problem: c.problem, tags: c.tags, attempts: c.attempts || [], pitfalls: c.pitfalls || [], solution: c.solution || null, snippet: c.snippet || null, created_at: c.created_at });
}
output({ capsules });
