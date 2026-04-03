#!/usr/bin/env node
// Usage: node preview-pii.mjs <draft-id>
import { CAPSULES_DIR, readJSON, output } from './lib/config.mjs';
import { detectPII } from './lib/pii.mjs';
import { join } from 'path';

const [,, id] = process.argv;
if (!id) { output({ error: 'Usage: preview-pii.mjs <draft-id>' }); process.exit(1); }

const draft = await readJSON(join(CAPSULES_DIR, `${id}.json`));
if (!draft) { output({ error: `Draft ${id} not found locally.` }); process.exit(1); }

const findings = detectPII(JSON.stringify(draft));
output({ id, findings, clean: findings.length === 0 });
