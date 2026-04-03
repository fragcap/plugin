#!/usr/bin/env node
// Start GitHub Device Flow — prints verification_uri and user_code
import { CLIENT_ID, DATA_DIR, writeJSON, output, proxyFetch } from './lib/config.mjs';
import { join } from 'path';

try {
  const res = await proxyFetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID })
  });
  const data = await res.json();
  if (data.error) { output({ error: `Failed: ${data.error_description || data.error}` }); process.exit(1); }

  await writeJSON(join(DATA_DIR, 'device_flow_pending.json'), {
    device_code: data.device_code,
    interval: data.interval || 5,
    expires_at: Date.now() + (data.expires_in || 900) * 1000
  });

  output({ verification_uri: data.verification_uri, user_code: data.user_code, expires_in: data.expires_in || 900 });
} catch (e) { output({ error: e.message }); process.exit(1); }
