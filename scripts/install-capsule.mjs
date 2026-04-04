#!/usr/bin/env node
// Usage: node install-capsule.mjs <gist-id> [target-dir]
// Fetches a capsule SKILL.md from a Gist and installs it to .claude/skills/
import { AUTH_PATH, readJSON, output, parseFrontmatter } from './lib/config.mjs';
import { getGist } from './lib/github.mjs';
import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';

const [,, gistId, targetDir] = process.argv;
if (!gistId) { output({ error: 'Usage: install-capsule.mjs <gist-id> [target-dir]' }); process.exit(1); }
if (!/^[a-f0-9]{20,32}$/i.test(gistId)) { output({ error: 'Invalid gist id format.' }); process.exit(1); }

try {
  const auth = await readJSON(AUTH_PATH);
  const { data, status } = await getGist(gistId, auth?.access_token);
  if (status === 404 || !data) { output({ error: 'Gist not found.' }); process.exit(1); }

  const file = data.files?.['SKILL.md'];
  if (!file?.content) { output({ error: 'SKILL.md not found in this gist.' }); process.exit(1); }

  const { meta } = parseFrontmatter(file.content);
  const id = meta.id || gistId;
  // Use gist ID as filename to prevent untrusted metadata from colliding with existing skills
  const safeName = `fragcap-${gistId}`;

  // Default to .claude/skills/ in current working directory
  const skillsDir = targetDir || join(process.cwd(), '.claude', 'skills');
  await mkdir(skillsDir, { recursive: true });

  const outPath = join(skillsDir, `${safeName}.md`);
  const exists = await access(outPath).then(() => true, () => false);
  await writeFile(outPath, file.content);

  output({
    success: true,
    installed_to: outPath,
    overwritten: exists,
    id,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    description: (meta.description || '').replace(/\\"/g, '"'),
  });
} catch (e) { output({ error: e.message }); process.exit(1); }
