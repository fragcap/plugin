#!/usr/bin/env node
// SessionStart hook: install npm deps if needed + check pending_review_flag
import { execSync } from 'child_process';
import { existsSync, readFileSync, copyFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
const dataDir = process.env.CLAUDE_PLUGIN_DATA
  || join(process.env.HOME || process.env.USERPROFILE || '', '.fragcap');

// ─── Dependency installation ────────────────────────────────────────────────

// Install deps in data dir (persists across plugin updates) using diff mode:
// only re-install when package.json changes.
const pkgSrc = join(pluginRoot, 'package.json');
const pkgDst = join(dataDir, 'package.json');

mkdirSync(dataDir, { recursive: true });

let needsInstall = false;
if (!existsSync(pkgDst)) {
  needsInstall = true;
} else {
  try {
    const src = readFileSync(pkgSrc, 'utf8');
    const dst = readFileSync(pkgDst, 'utf8');
    needsInstall = src !== dst;
  } catch {
    needsInstall = true;
  }
}

if (needsInstall) {
  console.error('[fragcap] Installing dependencies...');
  try {
    copyFileSync(pkgSrc, pkgDst);
    execSync('npm install --prefer-offline', { cwd: dataDir, stdio: 'inherit' });
    console.error('[fragcap] Dependencies installed.');
  } catch (e) {
    console.error('[fragcap] npm install failed:', e.message);
    // non-fatal: plugin may still work if deps exist
  }
}

// ─── Pending review flag check ──────────────────────────────────────────────

const flagPath = join(dataDir, 'pending_review_flag');

if (existsSync(flagPath)) {
  try {
    const capsulesDir = join(dataDir, 'capsules');
    let draftCount = 0;
    if (existsSync(capsulesDir)) {
      draftCount = readdirSync(capsulesDir).filter(f => f.endsWith('.json')).length;
    }

    if (draftCount > 0) {
      // Output to stdout so Claude sees the message
      console.log(`You have ${draftCount} pending capsule draft(s). Run /fragcap:review to review them.`);
    }

    // Clear the flag after notifying
    unlinkSync(flagPath);
  } catch {
    // non-fatal
  }
}
