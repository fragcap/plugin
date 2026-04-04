// PII detection and stripping — zero external dependencies
import { createHash } from 'crypto';
import { homedir } from 'os';

export function anonHash(username, id) {
  return createHash('sha256').update(username + id).digest('hex').slice(0, 8);
}

/** Detect relevant drive letters from the current environment. */
function detectDrives() {
  const drives = new Set();
  for (const src of [homedir(), process.env.USERPROFILE, process.env.HOMEDRIVE]) {
    const m = (src || '').match(/^([A-Za-z]):/);
    if (m) drives.add(m[1].toUpperCase());
  }
  if (drives.size === 0) drives.add('C'); // safe fallback
  return [...drives];
}

/** Build path patterns for a username across all platforms. */
function userPathPatterns(username) {
  const drives = detectDrives();
  return [
    // macOS
    `/Users/${username}`,
    // Linux
    `/home/${username}`,
    // Windows — JSON-escaped backslash form
    ...drives.map(d => `${d}:\\\\Users\\\\${username}`),
    // Windows — forward-slash form
    ...drives.map(d => `${d}:/Users/${username}`),
    // WSL mount
    ...drives.map(d => `/mnt/${d.toLowerCase()}/Users/${username}`),
    ...drives.map(d => `/mnt/${d.toLowerCase()}/users/${username}`),
  ];
}

function buildHomePattern() {
  const usernames = new Set();
  const osUser = process.env.USER || process.env.USERNAME || process.env.LOGNAME;
  if (osUser) usernames.add(osUser);

  const homeParts = homedir().split(/[/\\]/).filter(Boolean);
  const homeUser = homeParts[homeParts.length - 1];
  if (homeUser && homeUser !== 'root') usernames.add(homeUser);

  if (usernames.size === 0) return null;

  const patterns = [...usernames].flatMap(u => userPathPatterns(u));

  return new RegExp(
    `(${patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'
  );
}

/** Strip PII from a plain text string (markdown content). */
export function stripPIIText(text, ghUsername) {
  const homePattern = buildHomePattern();
  const ghPatterns = userPathPatterns(ghUsername);
  const ghPattern = new RegExp(
    `(${ghPatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'
  );

  let str = text;
  if (homePattern) str = str.replace(homePattern, '/Users/username');
  str = str.replace(ghPattern, '/Users/username');
  str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  return str;
}

/** Strip PII from a JSON object (legacy support). */
export function stripPII(obj, ghUsername) {
  let str = JSON.stringify(obj);
  str = stripPIIText(str, ghUsername);
  return JSON.parse(str);
}

/**
 * Apply visibility to a SKILL.md content string.
 * Returns the modified markdown string with updated frontmatter.
 */
export function applyVisibilityMd(content, visibility, username, capsuleId) {
  let result = content;

  if (visibility === 'anonymous') {
    const anonAuthor = `gh:anonymous-${anonHash(username, capsuleId)}`;
    // Update frontmatter fields
    result = result.replace(/^(visibility:\s*).+$/m, `$1anonymous`);
    result = result.replace(/^(author:\s*).+$/m, `$1"${anonAuthor}"`);
    // Strip PII from the entire content
    result = stripPIIText(result, username);
  } else {
    result = result.replace(/^(visibility:\s*).+$/m, `$1attributed`);
    result = result.replace(/^(author:\s*).+$/m, `$1"gh:${username}"`);
  }

  return result;
}

/** Legacy JSON visibility (kept for backwards compat). */
export function applyVisibility(capsule, visibility, username) {
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

export function detectPII(text) {
  const findings = [];

  const pathRe = /(\/Users\/([^\/\s"]+)|\/home\/([^\/\s"]+)|[A-Z]:\\\\Users\\\\([^\\\\"\\s]+)|[A-Z]:\\Users\\([^\\"\\s]+)|\/mnt\/[a-z]\/[Uu]sers\/([^\/\s"]+))/gi;
  for (const m of text.matchAll(pathRe)) {
    const username = m[2] || m[3] || m[4] || m[5] || m[6];
    findings.push({ type: 'file_path', original: m[0], suggestion: m[0].replace(username, 'username'), risk: 'identifies your OS username' });
  }

  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  for (const m of text.matchAll(emailRe)) {
    findings.push({ type: 'email', original: m[0], suggestion: '[email]', risk: 'personal or work email address' });
  }

  const internalRe = /https?:\/\/[^\s"]{0,200}?(\.internal|\.corp\.|\.intranet\.|internal[-.]|corp[-.])[^\s"]{0,200}/g;
  for (const m of text.matchAll(internalRe)) {
    findings.push({ type: 'internal_url', original: m[0], suggestion: '[internal-url]', risk: 'internal or company-specific URL' });
  }

  const ipRe = /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g;
  for (const m of text.matchAll(ipRe)) {
    findings.push({ type: 'private_ip', original: m[0], suggestion: '[private-ip]', risk: 'private network IP address' });
  }

  const apiKeyRe = /\b(?:sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36}|xox[bprs]-[a-zA-Z0-9\-]+)\b/g;
  for (const m of text.matchAll(apiKeyRe)) {
    findings.push({ type: 'api_key', original: m[0], suggestion: '[api-key]', risk: 'API key or access token' });
  }

  const tokenRe = /\b(?:Bearer\s+[a-zA-Z0-9._\-]{20,}|token\s*[:=]\s*["']?[a-zA-Z0-9._\-]{20,})/gi;
  for (const m of text.matchAll(tokenRe)) {
    findings.push({ type: 'token', original: m[0], suggestion: '[token]', risk: 'authentication token' });
  }

  const hostnameRe = /\b[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.(?:local|localhost|internal|corp|lan)\b/gi;
  for (const m of text.matchAll(hostnameRe)) {
    findings.push({ type: 'internal_hostname', original: m[0], suggestion: '[internal-host]', risk: 'internal hostname' });
  }

  const seen = new Set();
  return findings.filter(f => { if (seen.has(f.original)) return false; seen.add(f.original); return true; });
}
