#!/usr/bin/env node
// SessionStart hook: check if there are pending capsule drafts
import { DATA_DIR, CAPSULES_DIR } from './lib/config.mjs';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const flagPath = join(DATA_DIR, 'pending_review_flag');
if (!existsSync(flagPath)) process.exit(0);

try {
  let count = 0;
  if (existsSync(CAPSULES_DIR)) {
    count = readdirSync(CAPSULES_DIR).filter(f => f.endsWith('.json')).length;
  }
  if (count > 0) {
    // stdout on SessionStart is injected as context Claude can see
    console.log(`You have ${count} pending capsule draft(s). Run /fragcap:review to review them.`);
  }
  unlinkSync(flagPath);
} catch { /* non-fatal */ }
