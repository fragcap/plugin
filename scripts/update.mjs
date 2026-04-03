#!/usr/bin/env node
// Usage: node update.mjs <gist-id> <note> [status]
import { WORKER_URL, ensureValidToken, output, proxyFetch } from './lib/config.mjs';
import { getGist, updateGist } from './lib/github.mjs';

const [,, gistId, note, status] = process.argv;
if (!gistId || !note) { output({ error: 'Usage: update.mjs <gist-id> <note> [open|resolved|abandoned]' }); process.exit(1); }
if (!/^[a-f0-9]{20,32}$/i.test(gistId)) { output({ error: 'Invalid gist id format.' }); process.exit(1); }

try {
  const token = await ensureValidToken();
  const { data } = await getGist(gistId, token);
  const file = data.files?.['capsule.json'];
  if (!file?.content) { output({ error: 'capsule.json missing from gist.' }); process.exit(1); }

  const capsule = JSON.parse(file.content);
  const update = { date: new Date().toISOString().slice(0, 10), note };
  const VALID_STATUSES = new Set(['open', 'resolved', 'abandoned']);
  if (status && !VALID_STATUSES.has(status)) { output({ error: 'status must be one of: open, resolved, abandoned' }); process.exit(1); }
  if (status) update.status_change = status;

  const updated = {
    ...capsule,
    updates: [...(capsule.updates || []), update],
    updated_at: new Date().toISOString(),
    ...(status ? { status } : {})
  };

  const res = await updateGist(token, gistId, updated);
  if (res.status >= 400) { output({ error: `GitHub API error: ${res.data.message || res.status}` }); process.exit(1); }

  // Registry sync is best-effort for updates (unlike push.mjs where first registration
  // is mandatory). An update already persists on the gist itself; registry is a search index
  // that will catch up on the next push or manual sync.
  let registry = 'synced';
  try {
    const r = await proxyFetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gist_id: gistId }) });
    const rd = await r.json();
    if (!rd.ok) registry = rd.error || 'sync failed';
  } catch { registry = 'Worker unreachable — will sync later.'; }

  output({ success: true, gist_id: gistId, status: updated.status, updates_count: updated.updates.length, registry });
} catch (e) { output({ error: e.message }); process.exit(1); }
