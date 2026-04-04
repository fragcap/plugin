#!/usr/bin/env node
// Usage: node update.mjs <gist-id> <note> [status]
import { WORKER_URL, ensureValidToken, output, proxyFetch, parseFrontmatter } from './lib/config.mjs';
import { getGist, updateGist } from './lib/github.mjs';

const [,, gistId, note, status] = process.argv;
if (!gistId || !note) { output({ error: 'Usage: update.mjs <gist-id> <note> [open|resolved|abandoned]' }); process.exit(1); }
if (!/^[a-f0-9]{20,32}$/i.test(gistId)) { output({ error: 'Invalid gist id format.' }); process.exit(1); }

try {
  const token = await ensureValidToken();
  const { data } = await getGist(gistId, token);
  const file = data.files?.['SKILL.md'];
  if (!file?.content) { output({ error: 'SKILL.md missing from gist.' }); process.exit(1); }

  let content = file.content;
  const VALID_STATUSES = new Set(['open', 'resolved', 'abandoned']);
  if (status && !VALID_STATUSES.has(status)) { output({ error: 'status must be one of: open, resolved, abandoned' }); process.exit(1); }

  // Update frontmatter updated_at
  content = content.replace(/^(updated_at:\s*).+$/m, `$1${new Date().toISOString()}`);

  // Update status in frontmatter if requested
  if (status) {
    content = content.replace(/^(status:\s*).+$/m, `$1${status}`);
  }

  // Append update section at the end
  const date = new Date().toISOString().slice(0, 10);
  const updateBlock = `## Update (${date})\n\n${note}\n`;
  // Ensure content ends with exactly one blank line before the new section
  content = content.replace(/\n*$/, '\n\n') + updateBlock;

  const res = await updateGist(token, gistId, content);
  if (res.status >= 400) { output({ error: `GitHub API error: ${res.data.message || res.status}` }); process.exit(1); }

  // Count updates by counting ## Update headings
  const updateCount = (content.match(/^## Update/gm) || []).length;

  // Registry sync (best-effort)
  let registry = 'synced';
  try {
    const r = await proxyFetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gist_id: gistId }) });
    const rd = await r.json();
    if (!rd.ok) registry = rd.error || 'sync failed';
  } catch { registry = 'Worker unreachable — will sync later.'; }

  const { meta } = parseFrontmatter(content);
  output({ success: true, gist_id: gistId, status: meta.status || 'unknown', updates_count: updateCount, registry });
} catch (e) { output({ error: e.message }); process.exit(1); }
