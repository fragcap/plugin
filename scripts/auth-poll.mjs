#!/usr/bin/env node
// Single poll attempt for GitHub Device Flow
import { CLIENT_ID, DATA_DIR, AUTH_PATH, readJSON, writeJSON, output, proxyFetch } from './lib/config.mjs';
import { getAuthenticatedUser } from './lib/github.mjs';
import { join } from 'path';
import { unlink } from 'fs/promises';

const pendingPath = join(DATA_DIR, 'device_flow_pending.json');

try {
  const pending = await readJSON(pendingPath);
  if (!pending?.device_code) { output({ success: false, error: 'No pending Device Flow. Run auth-start first.' }); process.exit(0); }
  if (Date.now() >= pending.expires_at) { await unlink(pendingPath).catch(() => {}); output({ success: false, error: 'Code expired. Please retry /fragcap:auth.' }); process.exit(0); }

  const res = await proxyFetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, device_code: pending.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
  });
  const data = await res.json();

  if (data.error === 'authorization_pending') { output({ success: false, pending: true, message: 'Waiting for user authorization. Call again in a few seconds.' }); process.exit(0); }
  if (data.error === 'slow_down') {
    pending.interval = (pending.interval || 5) + 5;
    await writeJSON(pendingPath, pending);
    output({ success: false, pending: true, message: `Rate limited. Retry in ${pending.interval}s.` });
    process.exit(0);
  }
  if (data.error === 'expired_token') { await unlink(pendingPath).catch(() => {}); output({ success: false, error: 'Code expired. Please retry /fragcap:auth.' }); process.exit(0); }
  if (data.error) { output({ success: false, error: data.error_description || data.error }); process.exit(0); }

  const { data: user } = await getAuthenticatedUser(data.access_token);
  await writeJSON(AUTH_PATH, {
    access_token: data.access_token, refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in || 28800) * 1000).toISOString(),
    username: user.login
  });
  await unlink(pendingPath).catch(() => {});
  output({ success: true, username: user.login });
} catch (e) { output({ error: e.message }); process.exit(1); }
