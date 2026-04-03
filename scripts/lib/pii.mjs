// PII detection and stripping — zero external dependencies
import { createHash } from 'crypto';

export function anonHash(username, id) {
  return createHash('md5').update(username + id).digest('hex').slice(0, 6);
}

function buildHomePattern() {
  const usernames = new Set();
  const osUser = process.env.USER || process.env.USERNAME || process.env.LOGNAME;
  if (osUser) usernames.add(osUser);

  if (usernames.size === 0) return null;

  const patterns = [...usernames].flatMap(u => [
    `/Users/${u}`, `/home/${u}`,
    `C:\\\\Users\\\\${u}`,
    `/mnt/c/Users/${u}`, `/mnt/d/Users/${u}`
  ]);

  return new RegExp(
    `(${patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'
  );
}

export function stripPII(obj, ghUsername) {
  const homePattern = buildHomePattern();
  // Also add GitHub username paths
  const ghPatterns = [
    `/Users/${ghUsername}`, `/home/${ghUsername}`,
    `C:\\\\Users\\\\${ghUsername}`,
    `/mnt/c/Users/${ghUsername}`, `/mnt/d/Users/${ghUsername}`
  ];
  const ghPattern = new RegExp(
    `(${ghPatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'
  );

  let str = JSON.stringify(obj);
  if (homePattern) str = str.replace(homePattern, '/Users/username');
  str = str.replace(ghPattern, '/Users/username');
  str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  return JSON.parse(str);
}

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

  const pathRe = /(\/Users\/([^\/\s"]+)|\/home\/([^\/\s"]+)|C:\\Users\\([^\\"\\s]+)|\/mnt\/[a-z]\/Users\/([^\/\s"]+))/g;
  for (const m of text.matchAll(pathRe)) {
    const username = m[2] || m[3] || m[4] || m[5];
    findings.push({ type: 'file_path', original: m[0], suggestion: m[0].replace(username, 'username'), risk: 'identifies your OS username' });
  }

  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  for (const m of text.matchAll(emailRe)) {
    findings.push({ type: 'email', original: m[0], suggestion: '[email]', risk: 'personal or work email address' });
  }

  const internalRe = /https?:\/\/[^\s"]*?(\.internal|\.corp\.|\\.intranet\.|internal[-.]|corp[-.])[^\s"]*/g;
  for (const m of text.matchAll(internalRe)) {
    findings.push({ type: 'internal_url', original: m[0], suggestion: '[internal-url]', risk: 'internal or company-specific URL' });
  }

  const seen = new Set();
  return findings.filter(f => { if (seen.has(f.original)) return false; seen.add(f.original); return true; });
}
