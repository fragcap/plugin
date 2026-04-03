// FragCap configuration — zero external dependencies
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename, resolve } from 'path';
// ─── Proxy setup (dynamic import, only when proxy env var is set) ───────────
const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY
  || process.env.http_proxy || process.env.HTTP_PROXY;
if (proxyUrl) {
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import('node:undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } catch {
    console.log(JSON.stringify({ warning: 'Network request failed. If you are behind a proxy, upgrade to Node.js 22+ for automatic proxy support.' }, null, 2));
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────
export const CLIENT_ID   = 'Iv23liqwgua8sg2xc1v3';
export const WORKER_URL  = 'https://fragcap-worker.danuberiverferryman.workers.dev/register';
export const PAGES_BASE  = 'https://fragcap.github.io/registry';

// ─── Paths ─────────────────────────────────────────────────────────────────────
const rawDataDir = process.env.FRAGCAP_DATA || process.env.CLAUDE_PLUGIN_DATA;
if (!rawDataDir) {
  console.error(JSON.stringify({ error: 'FRAGCAP_DATA / CLAUDE_PLUGIN_DATA not set.' }));
  process.exit(1);
}
export const DATA_DIR = resolve(rawDataDir);
export const CAPSULES_DIR = join(DATA_DIR, 'capsules');
export const AUTH_PATH    = join(DATA_DIR, 'auth.json');
export const PUSHED_PATH  = join(DATA_DIR, 'pushed.json');
export const CACHE_DIR    = join(DATA_DIR, 'cache');

// ─── JSON helpers ──────────────────────────────────────────────────────────────
export async function readJSON(filePath, fallback = null) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); }
  catch { return fallback; }
}

const SENSITIVE_FILENAMES = new Set(['auth.json', 'device_flow_pending.json']);

export async function writeJSON(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const isSensitive = SENSITIVE_FILENAMES.has(basename(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2), isSensitive ? { mode: 0o600 } : undefined);
}

// ─── Output helper ─────────────────────────────────────────────────────────────
export function output(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// ─── Token management ──────────────────────────────────────────────────────────
export async function ensureValidToken() {
  const auth = await readJSON(AUTH_PATH);
  if (!auth?.access_token) throw new Error('Not authenticated. Run /fragcap:auth first.');

  if (new Date(auth.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return auth.access_token;
  }

  if (!auth.refresh_token) throw new Error('Session expired. Run /fragcap:auth to re-authenticate.');

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: auth.refresh_token })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Session expired (${data.error}). Run /fragcap:auth to re-authenticate.`);

  const updated = { ...auth, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString() };
  await writeJSON(AUTH_PATH, updated);
  return updated.access_token;
}
