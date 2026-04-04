#!/usr/bin/env node
// Usage: echo '<json>' | node generate-capsule.mjs
// Accepts capsule JSON on stdin (preferred) or as argv[2] for backwards compatibility
// Outputs a SKILL.md file (structured capsule as a Claude-loadable skill)
import { CAPSULES_DIR, DATA_DIR, output } from './lib/config.mjs';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
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

  const tags = input.tags || [];
  const problem = input.problem || '';
  const attempts = input.attempts || [];
  const pitfalls = input.pitfalls || [];
  const solution = input.solution || null;
  const snippet = input.snippet || null;
  const status = input.status || 'resolved';

  // Build SKILL.md content
  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`id: ${id}`);
  lines.push(`description: "${problem.replace(/"/g, '\\"').slice(0, 200)}"`);
  lines.push(`tags: [${tags.map(t => `"${t}"`).join(', ')}]`);
  lines.push(`status: ${status}`);
  lines.push(`visibility: anonymous`);
  lines.push(`author: "gh:anonymous-pending"`);
  lines.push(`created_at: ${now}`);
  lines.push(`updated_at: ${now}`);
  lines.push('---');
  lines.push('');

  // Title
  const title = tags[0]
    ? tags[0].split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Exploration Capsule';
  lines.push(`# ${title}`);
  lines.push('');

  // When to activate
  lines.push('## When to Activate');
  lines.push('');
  lines.push(`Use this capsule when encountering: ${problem.slice(0, 120)}`);
  lines.push('');

  // Problem
  lines.push('## Problem');
  lines.push('');
  lines.push(problem);
  lines.push('');

  // What was tried (attempts)
  if (attempts.length > 0) {
    lines.push('## What Does NOT Work');
    lines.push('');
    for (const a of attempts) {
      const tried = typeof a === 'string' ? a : a.tried || '';
      const outcome = typeof a === 'string' ? '' : a.outcome || '';
      lines.push(`- **${tried}**${outcome ? ` — ${outcome}` : ''}`);
    }
    lines.push('');
  }

  // Pitfalls
  if (pitfalls.length > 0) {
    lines.push('## Pitfalls');
    lines.push('');
    for (const p of pitfalls) {
      lines.push(`- ${p}`);
    }
    lines.push('');
  }

  // Solution / Fix
  if (solution) {
    lines.push('## Fix');
    lines.push('');
    lines.push(solution);
    lines.push('');
  }

  // Code snippet
  if (snippet) {
    lines.push('## Snippet');
    lines.push('');
    lines.push('```');
    lines.push(snippet);
    lines.push('```');
    lines.push('');
  }

  const content = lines.join('\n');
  await writeFile(join(CAPSULES_DIR, `${id}.md`), content);
  await writeFile(join(DATA_DIR, 'pending_review_flag'), String(Date.now()));
  output({ success: true, id });
} catch (e) { output({ error: e.message }); process.exit(1); }
