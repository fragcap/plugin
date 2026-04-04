#!/usr/bin/env node
// Usage: node search.mjs <query>
import { PAGES_BASE, CACHE_DIR, readJSON, writeJSON, output, proxyFetch } from './lib/config.mjs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const MANIFEST_TTL = 60 * 60 * 1000;
const SHARD_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — hash change drives invalidation now

const query = process.argv.slice(2).join(' ');
if (!query) { output({ results: [], message: 'No query provided.' }); process.exit(0); }

// ─── Keyword extraction ───────────────────────────────────────────────────────
const STOP_WORDS = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','how','do','i','my','use','using','when','why','what','is','are','was','get','set','make','work','works','working','need','want','try','tried','can','cannot','cant','does','doesnt','problem','issue','error','bug','fix']);
const keywords = query.toLowerCase().replace(/[^a-z0-9\s\-_.]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w)).slice(0, 6);
if (keywords.length === 0) { output({ results: [], message: 'Query too generic.' }); process.exit(0); }

// ─── Cached fetch ─────────────────────────────────────────────────────────────
async function fetchCached(url, cacheFile, ttl) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, cacheFile);
  const cached = await readJSON(cachePath);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;
  try {
    const res = await proxyFetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    await writeJSON(cachePath, { ts: Date.now(), data }).catch(() => {});
    return data;
  } catch { return cached?.data || null; }
}

// ─── Concurrency-limited parallel map ─────────────────────────────────────────
async function pMap(items, fn, concurrency = 5) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ─── Load all shards ──────────────────────────────────────────────────────────
const manifest = await fetchCached(`${PAGES_BASE}/manifest.json`, 'manifest.json', MANIFEST_TTL);
if (!manifest?.shards?.length) { output({ results: [], message: 'Registry not reachable or empty.', keywords }); process.exit(0); }

const shardResults = await pMap(manifest.shards, async (entry) => {
  // Compatible with v1 (string[]) and v2 ({ file, hash }[])
  const file = typeof entry === 'string' ? entry : entry.file;
  const hash = typeof entry === 'string' ? null  : entry.hash;

  const safeName = file.replace(/[^a-zA-Z0-9._-]/g, '_');
  // When hash changes → cacheFile changes → stale cache bypassed automatically
  const cacheFile = hash
    ? `shard_${safeName}_${hash}`
    : `shard_${safeName}`;

  const shard = await fetchCached(
    `${PAGES_BASE}/shards/${file}`,
    cacheFile,
    SHARD_TTL,
  );
  return shard?.capsules || [];
});
const capsules = shardResults.flat();

// ─── Score and rank ───────────────────────────────────────────────────────────
function toBigrams(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words.flatMap((w, i) => i < words.length - 1 ? [`${w} ${words[i + 1]}`] : []);
}

const queryBigrams = new Set(toBigrams(query));
const results = capsules
  .map(cap => {
    let score = 0;
    const haystack = [...(cap.tags || []), cap.problem || '', cap.summary || ''].join(' ').toLowerCase();
    const haystackWords = new Set(haystack.split(/\s+/));
    for (const kw of keywords) {
      if (cap.tags?.some(t => t.toLowerCase() === kw)) score += 3;
      else if (haystackWords.has(kw)) score += 1;
    }
    const haystackBigrams = new Set(toBigrams(haystack));
    for (const qb of queryBigrams) {
      if (haystackBigrams.has(qb)) score += 2;
    }
    if (cap.status === 'resolved') score += 0.5;
    return { ...cap, score };
  })
  .filter(r => r.score > 0)
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const order = { resolved: 0, open: 1, abandoned: 2 };
    const diff = (order[a.status] ?? 1) - (order[b.status] ?? 1);
    if (diff !== 0) return diff;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

output({ results: results.slice(0, 5), total_found: results.length, keywords });
