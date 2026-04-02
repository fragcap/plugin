#!/usr/bin/env node
// FragCap MCP Server v2
// Storage: GitHub Gist (per capsule)
// Discovery: GitHub Pages registry (fragcap.github.io/registry)
// Auth: GitHub App Device Flow — no PAT, no copy-paste

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';
import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

// ─── Proxy setup (respect https_proxy / HTTP_PROXY env vars) ─────────────────
const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY
  || process.env.http_proxy || process.env.HTTP_PROXY;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CLIENT_ID      = process.env.FRAGCAP_CLIENT_ID || '';
const WORKER_URL     = process.env.FRAGCAP_WORKER_URL
  ? `${process.env.FRAGCAP_WORKER_URL.replace(/\/register\/?$/, '').replace(/\/$/, '')}/register`
  : '';
const PAGES_BASE     = process.env.FRAGCAP_PAGES_BASE || '';

const DATA_DIR     = process.env.FRAGCAP_DATA
  || join(process.env.HOME || process.env.USERPROFILE || '', '.fragcap');

const CAPSULES_DIR    = join(DATA_DIR, 'capsules');
const AUTH_PATH       = join(DATA_DIR, 'auth.json');
const PUSHED_PATH     = join(DATA_DIR, 'pushed.json');
const CACHE_DIR       = join(DATA_DIR, 'cache');

const MANIFEST_TTL_MS = 60 * 60 * 1000;        // 1h
const SHARD_TTL_MS    = 24 * 60 * 60 * 1000;   // 24h

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readJSON(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJSON(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

function octokit(token) {
  return new Octokit({ auth: token });
}

function anonHash(username, id) {
  return createHash('md5').update(username + id).digest('hex').slice(0, 6);
}

function stripPII(obj, username) {
  const homePattern = new RegExp(
    `(/Users/${username}|/home/${username}|C:\\\\Users\\\\${username})`,
    'gi'
  );
  const str = JSON.stringify(obj)
    .replace(homePattern, '/Users/username')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  return JSON.parse(str);
}

function applyVisibility(capsule, visibility, username) {
  const c = structuredClone(capsule);
  if (visibility === 'anonymous') {
    c.visibility = 'anonymous';
    c.author = `gh:anonymous-${anonHash(username, capsule.id)}`;
    return stripPII(c, username);
  }
  c.visibility = 'attributed';
  c.author = `gh:${username}`;
  return c;
}

function gistDescription(capsule) {
  const tagBrackets = (capsule.tags || []).map(t => `[${t}]`).join('');
  return `[fragcap]${tagBrackets} ${(capsule.problem || capsule.id).slice(0, 80)}`;
}

// ─── Auth / Token management ──────────────────────────────────────────────────

async function ensureValidToken() {
  const auth = await readJSON(AUTH_PATH);
  if (!auth?.access_token) {
    throw new Error('Not authenticated. Run /fragcap:auth first.');
  }

  // Still valid (more than 5 minutes remaining)
  if (new Date(auth.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return auth.access_token;
  }

  // Attempt refresh
  if (!auth.refresh_token) {
    throw new Error('Session expired. Run /fragcap:auth to re-authenticate.');
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: auth.refresh_token
    })
  });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Session expired (${data.error}). Run /fragcap:auth to re-authenticate.`);
  }

  const updated = {
    ...auth,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
  };
  await writeJSON(AUTH_PATH, updated);
  return updated.access_token;
}

// ─── Pushed registry ─────────────────────────────────────────────────────────

async function readPushed() {
  return readJSON(PUSHED_PATH, {});
}

async function writePushed(map) {
  await writeJSON(PUSHED_PATH, map);
}

// ─── Registry Worker ─────────────────────────────────────────────────────────

async function registerWithWorker(gist_id) {
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gist_id })
    });
    return await res.json();
  } catch {
    // Non-fatal: Gist already created, registry is best-effort
    return { ok: false, error: 'Worker unreachable — registry will sync on next update.' };
  }
}

// ─── GitHub Pages cache helpers ───────────────────────────────────────────────

async function fetchPagesCached(url, cacheFile, ttlMs) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, cacheFile);
  const cached = await readJSON(cachePath);
  if (cached && Date.now() - cached.ts < ttlMs) return cached.data;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    await writeJSON(cachePath, { ts: Date.now(), data });
    return data;
  } catch {
    return cached?.data || null; // fall back to stale cache on network error
  }
}

async function loadAllShards() {
  const manifest = await fetchPagesCached(
    `${PAGES_BASE}/manifest.json`,
    'manifest.json',
    MANIFEST_TTL_MS
  );
  if (!manifest?.shards?.length) return [];

  const capsules = [];
  await Promise.all(manifest.shards.map(async (name) => {
    const shard = await fetchPagesCached(
      `${PAGES_BASE}/shards/${name}`,
      `shard_${name}`,
      SHARD_TTL_MS
    );
    if (shard?.capsules) capsules.push(...shard.capsules);
  }));
  return capsules;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function toBigrams(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words.flatMap((w, i) => i < words.length - 1 ? [`${w} ${words[i + 1]}`] : []);
}

function scoreMatch(capsule, keywords, query) {
  let score = 0;
  const haystack = [
    ...(capsule.tags || []),
    capsule.problem || '',
    capsule.summary || ''
  ].join(' ').toLowerCase();

  for (const kw of keywords) {
    if (capsule.tags?.some(t => t.toLowerCase() === kw)) score += 3;
    else if (haystack.includes(kw)) score += 1;
  }

  const queryBigrams = new Set(toBigrams(query));
  score += toBigrams(haystack).filter(b => queryBigrams.has(b)).length * 2;

  if (capsule.status === 'resolved') score += 0.5;
  return score;
}

function extractKeywords(query) {
  const stopWords = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'how','do','i','my','use','using','when','why','what','is','are','was',
    'get','set','make','work','works','working','need','want','try','tried',
    'can','cannot','cant','does','doesnt','problem','issue','error','bug','fix'
  ]);
  return query.toLowerCase()
    .replace(/[^a-z0-9\s\-_.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 6);
}

// ─── Tool implementations ──────────────────────────────────────────────────────

// Step 1: Request device code and return immediately so Claude can display the URL + code.
async function tool_device_flow_start() {
  const codeRes = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID })
  });
  const codeData = await codeRes.json();

  if (codeData.error) {
    return { error: `Failed to start Device Flow: ${codeData.error_description || codeData.error}` };
  }

  const { device_code, user_code, verification_uri, interval, expires_in } = codeData;

  // Persist device_code so poll can pick it up
  await writeJSON(join(DATA_DIR, 'device_flow_pending.json'), {
    device_code,
    interval: interval || 5,
    expires_at: Date.now() + (expires_in || 900) * 1000
  });

  return { verification_uri, user_code, expires_in: expires_in || 900 };
}

// Step 2: Single poll attempt — call repeatedly until success or expiry.
async function tool_device_flow_poll() {
  const pending = await readJSON(join(DATA_DIR, 'device_flow_pending.json'));
  if (!pending?.device_code) {
    return { success: false, error: 'No pending Device Flow. Run device_flow_start first.' };
  }

  if (Date.now() >= pending.expires_at) {
    await unlink(join(DATA_DIR, 'device_flow_pending.json')).catch(() => {});
    return { success: false, error: 'Code expired. Please retry /fragcap:auth.' };
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      device_code: pending.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  });
  const data = await tokenRes.json();

  if (data.error === 'authorization_pending') {
    return { success: false, pending: true, message: 'Waiting for user authorization. Call again in a few seconds.' };
  }
  if (data.error === 'slow_down') {
    return { success: false, pending: true, message: 'Rate limited. Call again in 10 seconds.' };
  }
  if (data.error === 'expired_token') {
    await unlink(join(DATA_DIR, 'device_flow_pending.json')).catch(() => {});
    return { success: false, error: 'Code expired. Please retry /fragcap:auth.' };
  }
  if (data.error) {
    return { success: false, error: data.error_description || data.error };
  }

  // Success — fetch username and store
  const gh = octokit(data.access_token);
  const { data: user } = await gh.users.getAuthenticated();

  await writeJSON(AUTH_PATH, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in || 28800) * 1000).toISOString(),
    username: user.login
  });

  await unlink(join(DATA_DIR, 'device_flow_pending.json')).catch(() => {});

  return { success: true, username: user.login };
}

// Check current authentication state without modifying anything.
async function tool_check_auth_status() {
  const auth = await readJSON(AUTH_PATH);
  if (!auth?.access_token) {
    return { authenticated: false, message: 'Not authenticated. Run /fragcap:auth.' };
  }

  const expiresAt = new Date(auth.expires_at);
  const now = new Date();

  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return { authenticated: true, username: auth.username, expires_at: auth.expires_at };
  }

  if (auth.refresh_token) {
    return {
      authenticated: true,
      username: auth.username,
      token_expired: true,
      message: 'Token expired but refresh token available. Will auto-refresh on next API call.'
    };
  }

  return { authenticated: false, message: 'Session expired. Run /fragcap:auth to re-authenticate.' };
}

async function tool_list_local_drafts() {
  const files = await readdir(CAPSULES_DIR).catch(() => []);
  if (files.length === 0) return { capsules: [], message: 'No local drafts.' };
  const capsules = [];
  for (const f of files.filter(f => f.endsWith('.json'))) {
    const c = await readJSON(join(CAPSULES_DIR, f));
    if (!c) continue;
    capsules.push({
      id: c.id,
      status: c.status,
      problem: c.problem,
      tags: c.tags,
      has_attempts: (c.attempts?.length || 0) > 0,
      has_pitfalls: (c.pitfalls?.length || 0) > 0,
      has_solution: !!c.solution,
      created_at: c.created_at
    });
  }
  return { capsules };
}

async function tool_list_pushed_capsules() {
  const token = await ensureValidToken();
  const auth = await readJSON(AUTH_PATH);
  const gh = octokit(token);
  const { data: gists } = await gh.gists.list({ per_page: 100 });
  const capsules = gists
    .filter(g => g.description?.startsWith('[fragcap]'))
    .map(g => ({
      gist_id: g.id,
      description: g.description,
      url: g.html_url,
      updated_at: g.updated_at
    }));
  return { capsules };
}

async function tool_push_capsule({ id, visibility = 'anonymous' }) {
  const token = await ensureValidToken();
  const auth = await readJSON(AUTH_PATH);
  const gh = octokit(token);

  const draftPath = join(CAPSULES_DIR, `${id}.json`);
  const draft = await readJSON(draftPath);
  if (!draft) return { error: `Draft ${id} not found locally.` };

  const pushed = await readPushed();
  if (pushed[id]) return { error: `Capsule ${id} already pushed. Use /fragcap:update to append.` };

  const published = applyVisibility(draft, visibility, auth.username);

  const { data: gist } = await gh.gists.create({
    description: gistDescription(published),
    public: true,
    files: { 'capsule.json': { content: JSON.stringify(published, null, 2) } }
  });

  pushed[id] = gist.id;
  await writePushed(pushed);
  await unlink(draftPath).catch(() => {});

  // Register with central registry (non-fatal on failure)
  const workerResult = await registerWithWorker(gist.id);

  return {
    success: true,
    gist_id: gist.id,
    url: gist.html_url,
    registry: workerResult.ok ? 'registered' : workerResult.error
  };
}

async function tool_search_capsules({ query }) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return { results: [], message: 'Query too generic.' };

  const capsules = await loadAllShards();
  if (capsules.length === 0) {
    return {
      results: [],
      message: 'Registry not reachable or empty. Try again later.',
      keywords
    };
  }

  const results = capsules
    .map(cap => ({ ...cap, score: scoreMatch(cap, keywords, query) }))
    .filter(r => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const statusOrder = { resolved: 0, open: 1, abandoned: 2 };
      const sa = statusOrder[a.status] ?? 1;
      const sb = statusOrder[b.status] ?? 1;
      if (sa !== sb) return sa - sb;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

  return { results: results.slice(0, 5), total_found: results.length, keywords };
}

async function tool_fetch_capsule({ gist_id }) {
  // Public Gists — no auth needed (60 req/h per IP; with auth: 5000/h)
  const auth = await readJSON(AUTH_PATH);
  const gh = auth?.access_token ? octokit(auth.access_token) : new Octokit();
  const { data } = await gh.gists.get({ gist_id });
  const file = data.files['capsule.json'];
  if (!file?.content) return { error: 'capsule.json not found in this gist.' };
  return { capsule: JSON.parse(file.content) };
}

async function tool_update_capsule({ gist_id, note, status }) {
  const token = await ensureValidToken();
  const gh = octokit(token);

  const { data } = await gh.gists.get({ gist_id });
  const file = data.files['capsule.json'];
  if (!file?.content) return { error: 'capsule.json missing from gist.' };

  const capsule = JSON.parse(file.content);
  const update = { date: new Date().toISOString().slice(0, 10), note };
  if (status) update.status_change = status;

  const updated = {
    ...capsule,
    updates: [...(capsule.updates || []), update],
    updated_at: new Date().toISOString(),
    ...(status ? { status } : {})
  };

  await gh.gists.update({
    gist_id,
    files: { 'capsule.json': { content: JSON.stringify(updated, null, 2) } }
  });

  // Sync registry (non-fatal)
  const workerResult = await registerWithWorker(gist_id);

  return {
    success: true,
    gist_id,
    status: updated.status,
    updates_count: updated.updates.length,
    registry: workerResult.ok ? 'synced' : workerResult.error
  };
}

async function tool_delete_draft({ id }) {
  const draftPath = join(CAPSULES_DIR, `${id}.json`);
  try {
    await unlink(draftPath);
    return { success: true, deleted: id };
  } catch (e) {
    if (e.code === 'ENOENT') return { error: `Draft ${id} not found locally.` };
    throw e;
  }
}

async function tool_preview_pii({ id }) {
  const draft = await readJSON(join(CAPSULES_DIR, `${id}.json`));
  if (!draft) return { error: `Draft ${id} not found locally.` };

  const findings = [];
  const text = JSON.stringify(draft);

  const pathRe = /(\/Users\/([^\/\s"]+)|\/home\/([^\/\s"]+)|C:\\Users\\([^\\"\s]+))/g;
  for (const m of text.matchAll(pathRe)) {
    const username = m[2] || m[3] || m[4];
    findings.push({
      type: 'file_path',
      original: m[0],
      suggestion: m[0].replace(username, 'username'),
      risk: 'identifies your OS username'
    });
  }

  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  for (const m of text.matchAll(emailRe)) {
    findings.push({ type: 'email', original: m[0], suggestion: '[email]', risk: 'personal or work email address' });
  }

  const internalRe = /https?:\/\/[^\s"]*?(\.internal|\.corp\.|\.intranet\.|internal[-.]|corp[-.])[^\s"]*/g;
  for (const m of text.matchAll(internalRe)) {
    findings.push({ type: 'internal_url', original: m[0], suggestion: '[internal-url]', risk: 'internal or company-specific URL' });
  }

  const seen = new Set();
  const unique = findings.filter(f => {
    if (seen.has(f.original)) return false;
    seen.add(f.original);
    return true;
  });

  return { id, findings: unique, clean: unique.length === 0 };
}

// ─── Tool registry ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'device_flow_start',
    description: 'Start GitHub Device Flow: returns verification_uri and user_code immediately. Show these to the user, then call device_flow_poll.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'device_flow_poll',
    description: 'Poll GitHub until the user completes authorization in the browser. Call after device_flow_start. Blocks until success or timeout (~15 min).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'check_auth_status',
    description: 'Check current authentication status: authenticated/expired/not authenticated',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_local_drafts',
    description: 'List capsule drafts saved locally, not yet pushed',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_pushed_capsules',
    description: 'List capsules already pushed as Gists',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'push_capsule',
    description: 'Push a local capsule draft to GitHub as a Gist, then register it in the central registry',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Capsule ID from list_local_drafts' },
        visibility: {
          type: 'string',
          enum: ['anonymous', 'attributed'],
          description: 'anonymous (default) strips PII and hides username; attributed shows your GitHub username'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'search_capsules',
    description: 'Search capsules across all FragCap users via the central registry (GitHub Pages, no rate limit)',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Current problem or question' } },
      required: ['query']
    }
  },
  {
    name: 'fetch_capsule',
    description: 'Fetch the full content of a capsule Gist',
    inputSchema: {
      type: 'object',
      properties: { gist_id: { type: 'string', description: 'Gist ID from search results' } },
      required: ['gist_id']
    }
  },
  {
    name: 'update_capsule',
    description: 'Append a follow-up finding to an already-pushed capsule and sync the registry',
    inputSchema: {
      type: 'object',
      properties: {
        gist_id: { type: 'string' },
        note: { type: 'string', description: 'New finding, correction, or confirmation' },
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'abandoned'],
          description: 'Updated status (optional)'
        }
      },
      required: ['gist_id', 'note']
    }
  },
  {
    name: 'delete_draft',
    description: 'Delete a local capsule draft permanently',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Draft ID to delete' } },
      required: ['id']
    }
  },
  {
    name: 'preview_pii',
    description: 'Scan a local draft for PII patterns before push — does not modify the draft',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Draft ID to scan' } },
      required: ['id']
    }
  }
];

const TOOL_HANDLERS = {
  device_flow_start:    tool_device_flow_start,
  device_flow_poll:     tool_device_flow_poll,
  check_auth_status:    tool_check_auth_status,
  list_local_drafts:    tool_list_local_drafts,
  list_pushed_capsules: tool_list_pushed_capsules,
  push_capsule:         tool_push_capsule,
  search_capsules:      tool_search_capsules,
  fetch_capsule:        tool_fetch_capsule,
  update_capsule:       tool_update_capsule,
  delete_draft:         tool_delete_draft,
  preview_pii:          tool_preview_pii
};

// ─── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'fragcap', version: '0.2.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const result = await handler(args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
