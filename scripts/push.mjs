#!/usr/bin/env node
// Usage: node push.mjs <capsule-id> [anonymous|attributed]
import { CAPSULES_DIR, PUSHED_PATH, AUTH_PATH, WORKER_URL, ensureValidToken, readJSON, writeJSON, output } from './lib/config.mjs';
import { createGist } from './lib/github.mjs';
import { applyVisibility } from './lib/pii.mjs';
import { join } from 'path';
import { unlink } from 'fs/promises';

const [,, id, visibility = 'anonymous', gistScope = 'public'] = process.argv;
if (!id) { output({ error: 'Usage: push.mjs <capsule-id> [anonymous|attributed] [public|secret]' }); process.exit(1); }
const isPublic = gistScope !== 'secret' && gistScope !== 'private'; // 'private' kept for backwards compat

try {
  const token = await ensureValidToken();
  const auth = await readJSON(AUTH_PATH);
  const draftPath = join(CAPSULES_DIR, `${id}.json`);
  const draft = await readJSON(draftPath);
  if (!draft) { output({ error: `Draft ${id} not found locally.` }); process.exit(1); }

  const pushed = await readJSON(PUSHED_PATH, {});
  if (pushed[id]) { output({ error: `Capsule ${id} already pushed. Use /fragcap:update to append.` }); process.exit(1); }

  const published = applyVisibility(draft, visibility, auth.username);
  const tagBrackets = (published.tags || []).map(t => `[${t}]`).join('');
  const description = `[fragcap]${tagBrackets} ${(published.problem || published.id).slice(0, 80)}`;

  const { status, data: gist } = await createGist(token, description, published, isPublic);
  if (status >= 400) { output({ error: `GitHub API error: ${gist.message || status}` }); process.exit(1); }

  pushed[id] = gist.id;
  await writeJSON(PUSHED_PATH, pushed);
  await unlink(draftPath).catch(() => {});

  // Register with central registry (only for public gists)
  let registry;
  if (isPublic) {
    registry = 'registered';
    try {
      const r = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gist_id: gist.id }) });
      const rd = await r.json();
      if (!rd.ok) registry = rd.error || 'sync failed';
    } catch { registry = 'Worker unreachable — will sync later.'; }
  } else {
    registry = 'skipped (private gist — not searchable by others)';
  }

  output({ success: true, gist_id: gist.id, url: gist.html_url, public: isPublic, registry });
} catch (e) { output({ error: e.message }); process.exit(1); }
