// FragCap configuration — zero external dependencies (improved)
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename, resolve } from 'path';
import { execSync } from 'child_process';
import http from 'http';
import https from 'https';

// ─── Proxy detection (lazy, cached) ────────────────────────────────────────────
let _proxyCache;          // undefined = not yet checked
let _proxyCacheTime = 0;
const PROXY_CACHE_TTL = 60_000; // re-detect every 60s (handles VPN changes)

function _exec(cmd) {
  return execSync(cmd, {
    encoding: 'utf8',
    timeout: 3_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function _normalize(raw) {
  return raw && !raw.startsWith('http') ? `http://${raw}` : raw;
}

function detectSystemProxy() {
  // 1. Environment variables (highest priority)
  const envProxy =
    process.env.https_proxy || process.env.HTTPS_PROXY ||
    process.env.http_proxy  || process.env.HTTP_PROXY;
  if (envProxy) return envProxy;

  try {
    if (process.platform === 'win32') {
      const regBase =
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
      if (!_exec(`reg query "${regBase}" /v ProxyEnable`).includes('0x1'))
        return null;
      const m = _exec(`reg query "${regBase}" /v ProxyServer`)
        .match(/ProxyServer\s+REG_SZ\s+(.+)/);
      return m ? _normalize(m[1].trim()) : null;
    }

    if (process.platform === 'darwin') {
      const services = _exec('networksetup -listnetworkserviceorder');
      for (const svc of ['Wi-Fi', 'Ethernet', 'USB 10/100/1000 LAN']) {
        if (!services.includes(svc)) continue;
        for (const getter of ['-getsecurewebproxy', '-getwebproxy']) {
          const out = _exec(`networksetup ${getter} "${svc}"`);
          if (!/Enabled:\s*Yes/i.test(out)) continue;
          const host = out.match(/Server:\s*(.+)/)?.[1]?.trim();
          const port = out.match(/Port:\s*(\d+)/)?.[1]?.trim();
          if (host && host !== '0.0.0.0')
            return _normalize(`${host}:${port || 80}`);
        }
      }
      return null;
    }

    if (process.platform === 'linux') {
      const mode = _exec('gsettings get org.gnome.system.proxy mode')
        .replace(/'/g, '');
      if (mode !== 'manual') return null;
      for (const schema of [
        'org.gnome.system.proxy.https',
        'org.gnome.system.proxy.http',
      ]) {
        const host = _exec(`gsettings get ${schema} host`).replace(/'/g, '');
        const port = _exec(`gsettings get ${schema} port`);
        if (host) return _normalize(`${host}:${port || 80}`);
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Lazily resolves and caches system proxy URL, refreshing after TTL. */
function getProxy() {
  const now = Date.now();
  if (_proxyCache !== undefined && now - _proxyCacheTime < PROXY_CACHE_TTL) {
    return _proxyCache;
  }
  _proxyCache = detectSystemProxy();
  _proxyCacheTime = now;
  return _proxyCache;
}

// ─── proxyFetch — drop-in-compatible but NOT a global override ──────────────
const MAX_REDIRECTS = 5;

function buildNodeResponse(res, body) {
  const headers = new Map();
  for (const [k, v] of Object.entries(res.headers)) {
    headers.set(k.toLowerCase(), Array.isArray(v) ? v.join(', ') : v);
  }
  return {
    ok:         res.statusCode >= 200 && res.statusCode < 300,
    status:     res.statusCode,
    statusText: res.statusMessage || '',
    headers: {
      get: (k) => headers.get(k.toLowerCase()) ?? null,
      has: (k) => headers.has(k.toLowerCase()),
      entries: () => headers.entries(),
    },
    json:        async () => JSON.parse(body.toString('utf8')),
    text:        async () => body.toString('utf8'),
    arrayBuffer: async () => body.buffer.slice(
      body.byteOffset, body.byteOffset + body.byteLength,
    ),
  };
}

function collectBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('error', reject);
    res.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function connectTunnel(proxyUrl, target) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: proxyUrl.hostname,
      port:     proxyUrl.port || 80,
      method:   'CONNECT',
      path:     `${target.hostname}:${target.port || 443}`,
      headers:  proxyUrl.username
        ? { 'Proxy-Authorization': 'Basic ' +
            Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password || '')}`).toString('base64') }
        : {},
    });
    req.on('connect', (res, socket) => {
      if (res.statusCode === 200) resolve(socket);
      else {
        socket.destroy();
        reject(new Error(`Proxy CONNECT ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('Proxy CONNECT timeout')); });
    req.end();
  });
}

/**
 * Fetch with automatic proxy support.
 * Does NOT override globalThis.fetch — import it explicitly where needed.
 */
export async function proxyFetch(url, opts = {}, _redirectCount = 0) {
  const target  = new URL(url);
  const isHttps = target.protocol === 'https:';
  const mod     = isHttps ? https : http;
  const proxy   = getProxy();
  const proxyUrl = proxy ? new URL(proxy) : null;

  const headers = { ...opts.headers };
  // Auto-set Content-Length for non-stream bodies
  if (opts.body && typeof opts.body === 'string') {
    headers['content-length'] = Buffer.byteLength(opts.body);
  } else if (Buffer.isBuffer(opts.body)) {
    headers['content-length'] = opts.body.length;
  }

  let req;
  let socket;

  try {
    if (!proxyUrl) {
      // ── Direct ──
      req = mod.request(url, { method: opts.method || 'GET', headers });
    } else if (isHttps) {
      // ── HTTPS via CONNECT tunnel ──
      socket = await connectTunnel(proxyUrl, target);
      req = https.request({
        hostname: target.hostname,
        port:     target.port || 443,
        path:     target.pathname + target.search,
        method:   opts.method || 'GET',
        headers,
        socket,
        agent: false,
      });
    } else {
      // ── HTTP via forward proxy ──
      req = http.request({
        hostname: proxyUrl.hostname,
        port:     proxyUrl.port || 80,
        path:     url,                       // absolute URI for forward proxy
        method:   opts.method || 'GET',
        headers,
      });
    }

    // Timeout on the actual request
    req.setTimeout(opts.timeout ?? 30_000, () => {
      req.destroy();
    });

    const res = await new Promise((resolve, reject) => {
      req.on('response', resolve);
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });

    // ── Follow redirects (301/302/307/308) ──
    if ([301, 302, 307, 308].includes(res.statusCode)) {
      // Clean up tunnel socket if present
      socket?.destroy();

      if (_redirectCount >= MAX_REDIRECTS)
        throw new Error(`Too many redirects (${MAX_REDIRECTS})`);

      const location = res.headers.location;
      if (!location) throw new Error('Redirect without Location header');

      const nextUrl = new URL(location, url).href;
      // 301/302 convert to GET; 307/308 preserve method
      const nextOpts =
        res.statusCode <= 302
          ? { ...opts, method: 'GET', body: undefined }
          : opts;

      // Drain current response so the socket can be reused
      res.resume();
      return proxyFetch(nextUrl, nextOpts, _redirectCount + 1);
    }

    const body = await collectBody(res);
    return buildNodeResponse(res, body);
  } catch (err) {
    // Ensure tunnel socket is cleaned up on any error
    socket?.destroy();
    throw err;
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────
export const CLIENT_ID  = 'Iv23liqwgua8sg2xc1v3';
export const WORKER_URL = 'https://fragcap-worker.danuberiverferryman.workers.dev/register';
export const PAGES_BASE = 'https://fragcap.github.io/registry';

// ─── Paths (throw instead of process.exit) ─────────────────────────────────────
const rawDataDir = process.env.FRAGCAP_DATA || process.env.CLAUDE_PLUGIN_DATA;
if (!rawDataDir) {
  throw new Error(
    'FRAGCAP_DATA or CLAUDE_PLUGIN_DATA environment variable must be set.',
  );
}
export const DATA_DIR     = resolve(rawDataDir);
export const CAPSULES_DIR = join(DATA_DIR, 'capsules');
export const AUTH_PATH     = join(DATA_DIR, 'auth.json');
export const PUSHED_PATH   = join(DATA_DIR, 'pushed.json');
export const CACHE_DIR     = join(DATA_DIR, 'cache');

// ─── JSON helpers ──────────────────────────────────────────────────────────────

/**
 * Read and parse a JSON file.
 * - File not found → returns `fallback` (default null).
 * - File exists but is corrupt → throws (caller should know).
 */
export async function readJSON(filePath, fallback = null) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err; // permission error, etc.
  }
  return JSON.parse(raw);
}

const SENSITIVE_FILENAMES = new Set(['auth.json', 'device_flow_pending.json']);

export async function writeJSON(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const isSensitive = SENSITIVE_FILENAMES.has(basename(filePath));
  await writeFile(
    filePath,
    JSON.stringify(data, null, 2),
    isSensitive ? { mode: 0o600 } : undefined,
  );
}

// ─── Output helper ─────────────────────────────────────────────────────────────
export function output(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// ─── Token management (with mutex to prevent concurrent refresh) ────────────
let _refreshPromise = null;

export async function ensureValidToken() {
  const auth = await readJSON(AUTH_PATH);
  if (!auth?.access_token)
    throw new Error('Not authenticated. Run /fragcap:auth first.');

  // Token still valid (>5 min remaining)
  if (new Date(auth.expires_at) > new Date(Date.now() + 5 * 60_000)) {
    return auth.access_token;
  }

  if (!auth.refresh_token)
    throw new Error('Session expired. Run /fragcap:auth to re-authenticate.');

  // Coalesce concurrent refresh attempts into one
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await proxyFetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id:     CLIENT_ID,
            grant_type:    'refresh_token',
            refresh_token: auth.refresh_token,
          }),
        },
      );
      const data = await res.json();
      if (data.error)
        throw new Error(
          `Token refresh failed (${data.error}). Run /fragcap:auth to re-authenticate.`,
        );

      const updated = {
        ...auth,
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    new Date(Date.now() + data.expires_in * 1000).toISOString(),
      };
      await writeJSON(AUTH_PATH, updated);
      return updated.access_token;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}
