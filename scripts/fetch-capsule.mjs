#!/usr/bin/env node
// Usage: node fetch-capsule.mjs <gist-id>
import { AUTH_PATH, readJSON, output } from './lib/config.mjs';
import { getGist } from './lib/github.mjs';

const [,, gistId] = process.argv;
if (!gistId) { output({ error: 'Usage: fetch-capsule.mjs <gist-id>' }); process.exit(1); }
if (!/^[a-f0-9]{20,32}$/i.test(gistId)) { output({ error: 'Invalid gist id format.' }); process.exit(1); }

try {
  const auth = await readJSON(AUTH_PATH);
  const { data } = await getGist(gistId, auth?.access_token);
  const file = data.files?.['capsule.json'];
  if (!file?.content) { output({ error: 'capsule.json not found in this gist.' }); process.exit(1); }
  output({ capsule: JSON.parse(file.content) });
} catch (e) { output({ error: e.message }); process.exit(1); }
