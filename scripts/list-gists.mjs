#!/usr/bin/env node
import { ensureValidToken, output } from './lib/config.mjs';
import { listGists } from './lib/github.mjs';

try {
  const token = await ensureValidToken();
  const { data: gists } = await listGists(token);
  const capsules = gists
    .filter(g => g.description?.startsWith('[fragcap]'))
    .map(g => ({ gist_id: g.id, description: g.description, url: g.html_url, updated_at: g.updated_at }));
  output({ capsules });
} catch (e) { output({ error: e.message }); process.exit(1); }
