#!/usr/bin/env node
// SessionStart hook: check if there are pending capsule drafts
import { DATA_DIR, CAPSULES_DIR } from './lib/config.mjs';
import { readdir, unlink, access } from 'fs/promises';
import { join } from 'path';

const flagPath = join(DATA_DIR, 'pending_review_flag');
try { await access(flagPath); } catch { process.exit(0); }

try {
  const files = await readdir(CAPSULES_DIR).catch(() => []);
  const count = files.filter(f => f.endsWith('.json')).length;
  if (count > 0) {
    // stdout on SessionStart is injected as context Claude can see
    console.log(`You have ${count} pending capsule draft(s). Run /fragcap:review to review them.`);
  }
  await unlink(flagPath);
} catch { /* non-fatal */ }
