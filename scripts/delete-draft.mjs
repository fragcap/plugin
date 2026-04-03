#!/usr/bin/env node
// Usage: node delete-draft.mjs <draft-id>
import { CAPSULES_DIR, output } from './lib/config.mjs';
import { unlink } from 'fs/promises';
import { join } from 'path';

const [,, id] = process.argv;
if (!id) { output({ error: 'Usage: delete-draft.mjs <draft-id>' }); process.exit(1); }

try {
  await unlink(join(CAPSULES_DIR, `${id}.json`));
  output({ success: true, deleted: id });
} catch (e) {
  if (e.code === 'ENOENT') output({ error: `Draft ${id} not found locally.` });
  else { output({ error: e.message }); process.exit(1); }
}
