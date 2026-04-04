#!/usr/bin/env node
// Usage: node delete-draft.mjs <draft-id>
import { CAPSULES_DIR, output } from './lib/config.mjs';
import { unlink } from 'fs/promises';
import { join, resolve } from 'path';

const [,, id] = process.argv;
if (!id) { output({ error: 'Usage: delete-draft.mjs <draft-id>' }); process.exit(1); }
if (!/^[a-zA-Z0-9][a-zA-Z0-9\-_]{0,100}$/.test(id)) { output({ error: 'Invalid draft id.' }); process.exit(1); }

const target = resolve(join(CAPSULES_DIR, `${id}.md`));
if (!target.startsWith(resolve(CAPSULES_DIR))) { output({ error: 'Invalid draft id.' }); process.exit(1); }

try {
  await unlink(target);
  output({ success: true, deleted: id });
} catch (e) {
  if (e.code === 'ENOENT') output({ error: `Draft ${id} not found locally.` });
  else { output({ error: e.message }); process.exit(1); }
}
