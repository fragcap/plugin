// Zero-dependency GitHub API wrapper
import { proxyFetch } from './config.mjs';
const GITHUB_API = 'https://api.github.com';

export async function githubAPI(method, path, token, body = null) {
  const res = await proxyFetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'User-Agent': 'fragcap',
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  // Detect GitHub rate limiting early
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = res.headers.get('x-ratelimit-reset');
    const wait = reset ? Math.ceil((reset * 1000 - Date.now()) / 60000) : '?';
    return { status: 403, data: { message: `Rate limited. Resets in ~${wait} min.` } };
  }

  let data = null;
  if (res.status !== 204) {
    try { data = await res.json(); }
    catch { data = { message: await res.text() }; }
  }
  return { status: res.status, data };
}

export async function createGist(token, description, content, isPublic = true) {
  return githubAPI('POST', '/gists', token, {
    description, public: isPublic,
    files: { 'SKILL.md': { content } }
  });
}

export async function updateGist(token, gistId, content) {
  return githubAPI('PATCH', `/gists/${gistId}`, token, {
    files: { 'SKILL.md': { content } }
  });
}

export async function getGist(gistId, token = null) {
  return githubAPI('GET', `/gists/${gistId}`, token);
}

const MAX_PAGES = 20;

export async function listGists(token) {
  const all = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const { status, data } = await githubAPI('GET', `/gists?per_page=100&page=${page}`, token);
    if (status >= 400) return { status, data };
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return { status: 200, data: all };
}

export async function getAuthenticatedUser(token) {
  return githubAPI('GET', '/user', token);
}

export async function deleteGist(token, gistId) {
  return githubAPI('DELETE', `/gists/${gistId}`, token);
}
