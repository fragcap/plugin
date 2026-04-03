#!/usr/bin/env node
// Usage: node delete-gist.mjs <gist-id>
import { PUSHED_PATH, ensureValidToken, readJSON, writeJSON, output } from './lib/config.mjs';
import { deleteGist } from './lib/github.mjs';

const [,, gistId] = process.argv;
if (!gistId) { output({ error: 'Usage: delete-gist.mjs <gist-id>' }); process.exit(1); }

try {
  const token = await ensureValidToken();
  const { status, data } = await deleteGist(token, gistId);
  if (status === 404) { output({ error: `Gist ${gistId} not found — it may have already been deleted.` }); process.exit(1); }
  if (status === 403) { output({ error: 'Permission denied — you can only delete your own capsules.' }); process.exit(1); }
  if (status >= 400) { output({ error: `GitHub API error: ${data?.message || status}` }); process.exit(1); }

  // Remove from local pushed index
  const pushed = await readJSON(PUSHED_PATH, {});
  const entry = Object.entries(pushed).find(([, v]) => v === gistId);
  if (entry) {
    const updated = { ...pushed };
    delete updated[entry[0]];
    await writeJSON(PUSHED_PATH, updated);
  }

  output({ success: true, deleted: gistId });
} catch (e) { output({ error: e.message }); process.exit(1); }
