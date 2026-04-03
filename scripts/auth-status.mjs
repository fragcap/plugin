#!/usr/bin/env node
import { AUTH_PATH, readJSON, output } from './lib/config.mjs';

const auth = await readJSON(AUTH_PATH);
if (!auth?.access_token) { output({ authenticated: false, message: 'Not authenticated. Run /fragcap:auth.' }); process.exit(0); }

const expiresAt = new Date(auth.expires_at);
if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
  output({ authenticated: true, username: auth.username, expires_at: auth.expires_at });
} else if (auth.refresh_token) {
  output({ authenticated: true, username: auth.username, token_expired: true, message: 'Token expired but refresh token available. Will auto-refresh on next API call.' });
} else {
  output({ authenticated: false, message: 'Session expired. Run /fragcap:auth to re-authenticate.' });
}
