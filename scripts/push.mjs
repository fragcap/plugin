#!/usr/bin/env node
// Usage: node push.mjs <capsule-id> [anonymous|attributed]
import { CAPSULES_DIR, PUSHED_PATH, AUTH_PATH, WORKER_URL, ensureValidToken, readJSON, writeJSON, output, proxyFetch } from './lib/config.mjs';
import { createGist, deleteGist } from './lib/github.mjs';
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

  // Optimistic write — mark as pending before creating gist to prevent orphans
  pushed[id] = 'pending';
  await writeJSON(PUSHED_PATH, pushed);

  const { status, data: gist } = await createGist(token, description, published, isPublic);
  if (status >= 400) {
    delete pushed[id];
    await writeJSON(PUSHED_PATH, pushed);
    output({ error: `GitHub API error: ${gist.message || status}` }); process.exit(1);
  }

  pushed[id] = gist.id;
  await writeJSON(PUSHED_PATH, pushed);
  // Draft deletion is deferred until after registration succeeds (for public gists).

  // Register with central registry (only for public gists)
  // Must succeed — if it fails, roll back by deleting the public gist.
  // Retry with backoff to handle GitHub API propagation delay after Gist creation.
  let registry;
  if (isPublic) {
    let registrationFailed = false;
    let registrationError = '';
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 3000, 5000]; // ms — escalating backoff
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
      }
      registrationFailed = false;
      registrationError = '';
      try {
        const r = await proxyFetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gist_id: gist.id }) });
        const rd = await r.json();
        if (!rd.ok) {
          registrationFailed = true;
          registrationError = rd.error || 'sync failed';
          // Only retry on "not found" errors (propagation delay); other errors are permanent
          if (!/not found/i.test(registrationError)) break;
        } else {
          registry = 'registered';
          break;
        }
      } catch { registrationFailed = true; registrationError = 'Worker unreachable'; break; }
    }

    if (registrationFailed) {
      // Roll back: remove the public gist so it doesn't linger unregistered
      try {
        await deleteGist(token, gist.id);
        delete pushed[id];
        await writeJSON(PUSHED_PATH, pushed);
      } catch {
        // Rollback itself failed — mark for manual cleanup
        pushed[id] = `rollback_failed:${gist.id}`;
        await writeJSON(PUSHED_PATH, pushed).catch(() => {});
      }
      output({
        error: `Registration failed: ${registrationError}. The public Gist has been rolled back.`,
        suggest_secret: true,
        message: 'You can upload as secret instead — the capsule will be saved to GitHub Gist but won\'t appear in the public index. You can still access it via its URL next time.',
      });
      process.exit(1);
    }
  } else {
    registry = 'skipped (secret gist — not searchable by others)';
  }

  // Everything succeeded — now it is safe to remove the local draft.
  await unlink(draftPath).catch(() => {});

  output({ success: true, gist_id: gist.id, url: gist.html_url, public: isPublic, registry });
} catch (e) { output({ error: e.message }); process.exit(1); }
