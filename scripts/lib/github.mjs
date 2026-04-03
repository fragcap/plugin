// Zero-dependency GitHub API wrapper using Node built-in fetch
const GITHUB_API = 'https://api.github.com';

export async function githubAPI(method, path, token, body = null) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'User-Agent': 'fragcap',
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json();
  return { status: res.status, data };
}

export async function createGist(token, description, content, isPublic = true) {
  return githubAPI('POST', '/gists', token, {
    description, public: isPublic,
    files: { 'capsule.json': { content: JSON.stringify(content, null, 2) } }
  });
}

export async function updateGist(token, gistId, content) {
  return githubAPI('PATCH', `/gists/${gistId}`, token, {
    files: { 'capsule.json': { content: JSON.stringify(content, null, 2) } }
  });
}

export async function getGist(gistId, token = null) {
  return githubAPI('GET', `/gists/${gistId}`, token);
}

export async function listGists(token) {
  return githubAPI('GET', '/gists?per_page=100', token);
}

export async function getAuthenticatedUser(token) {
  return githubAPI('GET', '/user', token);
}
