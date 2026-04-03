#!/usr/bin/env node
// Usage: node preview-pii.mjs <draft-id>
import { CAPSULES_DIR, readJSON, output } from './lib/config.mjs';
import { detectPII } from './lib/pii.mjs';
import { join, resolve } from 'path';

const [,, id] = process.argv;
if (!id) { output({ error: 'Usage: preview-pii.mjs <draft-id>' }); process.exit(1); }
if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_]{0,100}$/.test(id)) { output({ error: 'Invalid draft id.' }); process.exit(1); }

const target = resolve(join(CAPSULES_DIR, `${id}.json`));
if (!target.startsWith(resolve(CAPSULES_DIR))) { output({ error: 'Invalid draft id.' }); process.exit(1); }

const draft = await readJSON(target);
if (!draft) { output({ error: `Draft ${id} not found locally.` }); process.exit(1); }

const findings = detectPII(JSON.stringify(draft));
output({ id, findings, clean: findings.length === 0 });
