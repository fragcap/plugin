#!/usr/bin/env node
// Stop hook: evaluate session and silently generate a capsule draft if actionable.
// Reads conversation payload from stdin (Claude Code hook format).
// Saves draft to ${FRAGCAP_DATA}/capsules/{id}.json — never interrupts the user.

import Anthropic from '@anthropic-ai/sdk';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const DATA_DIR = process.env.FRAGCAP_DATA
  || join(process.env.HOME || process.env.USERPROFILE || '', '.fragcap');

const CAPSULES_DIR = join(DATA_DIR, 'capsules');

async function main() {
  // Read hook payload from stdin
  let payload = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch {
    // No payload or invalid JSON — exit silently
    process.exit(0);
  }

  const messages = extractMessages(payload);

  // Minimum threshold: at least 4 messages and some tool use (indicates real work happened)
  if (messages.length < 4) process.exit(0);
  const hasToolUse = messages.some(m =>
    Array.isArray(m.content)
      ? m.content.some(b => b.type === 'tool_use' || b.type === 'tool_result')
      : false
  );
  if (!hasToolUse) process.exit(0);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[fragcap] ANTHROPIC_API_KEY not set — skipping capsule generation.');
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });

  // Build a condensed transcript — prioritize user messages (questions/decisions) and
  // assistant text (analysis/conclusions); keep only the tail of tool_result content.
  const transcript = buildTranscript(messages);

  const prompt = `You are analyzing a developer's exploration session transcript.
Your task: evaluate if this session contains actionable knowledge worth saving, and if so, generate a structured capsule.

TRANSCRIPT:
${transcript}

Evaluate and respond with ONLY valid JSON — one of two shapes:

Shape A (skip — nothing actionable):
{ "skip": true, "reason": "one sentence" }

Shape B (generate capsule — quality_score >= 0.3):
{
  "skip": false,
  "quality_score": 0.0-1.0,
  "capsule": {
    "schema_version": 1,
    "tags": ["specific-lib", "specific-api", "error-type"],
    "problem": "one sentence: what was being solved",
    "attempts": [
      { "tried": "what was attempted", "outcome": "what happened" }
    ],
    "pitfalls": ["specific trap or gotcha"],
    "solution": "what finally worked, or null if unresolved",
    "snippet": "optional directly-usable code or prompt, or null",
    "status": "resolved|open|abandoned"
  }
}

Quality scoring:
- 0.3+: has at least one concrete attempt with outcome, OR a specific pitfall, OR a working solution
- 0.0-0.3: return skip:true

Tags must be specific (library names, API names, error types). Never use generic tags like "javascript", "bug", "api".`;

  let result;
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are generating a reusable knowledge capsule from a developer session.
CRITICAL — scrub all personal information from your output before writing it:
- Replace ALL file system paths with generic equivalents (/project/src/...)
- Replace ALL email addresses with [email]
- Replace ALL internal or company URLs with [internal-url]
- Replace ALL person names with generic roles (colleague, reviewer, maintainer)
- Do NOT include API keys, tokens, passwords, or credentials of any kind
- Do NOT include company names, product codenames, or internal project identifiers`,
      messages: [{ role: 'user', content: prompt }]
    });
    result = JSON.parse(response.content[0].text.trim());
  } catch (e) {
    console.error('[fragcap] Generation failed:', e.message);
    process.exit(0);
  }

  if (result.skip) process.exit(0);

  // Build final capsule
  const now = new Date().toISOString();
  const sessionId = payload.session_id || createHash('md5').update(now).digest('hex').slice(0, 8);
  const slug = (result.capsule.tags[0] || 'exploration') + '-' + now.slice(0, 7).replace('-', '');
  const hash = createHash('md5').update(sessionId).digest('hex').slice(0, 4);
  const id = `${slug}-${hash}`;

  // quality_score is a generation artifact — not persisted in the capsule schema
  const { quality_score, ...capsuleFields } = result.capsule;
  const capsule = {
    ...capsuleFields,
    id,
    created_at: now,
    updated_at: now,
    visibility: 'anonymous',        // default; user sets final visibility on push
    author: 'gh:anonymous-pending', // replaced on push
    updates: []
  };

  // Save to local drafts
  await mkdir(CAPSULES_DIR, { recursive: true });
  await writeFile(join(CAPSULES_DIR, `${id}.json`), JSON.stringify(capsule, null, 2));

  // Signal to the user on next SessionStart (written to a flag file)
  const flagPath = join(DATA_DIR, 'pending_review_flag');
  await writeFile(flagPath, String(Date.now()));
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
    setTimeout(() => resolve(data), 10000); // 10s timeout for large session payloads
  });
}

function extractMessages(payload) {
  // Claude Code Stop hook may provide messages directly or via transcript_path
  if (Array.isArray(payload.messages)) return payload.messages;
  if (Array.isArray(payload.transcript)) return payload.transcript;
  return [];
}

function buildTranscript(messages) {
  // Role-based filtering: user messages carry the questions and decisions;
  // assistant text carries analysis and conclusions; tool_result is low-signal.
  const lines = [];
  for (const m of messages) {
    const blocks = Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content || '' }];

    if (m.role === 'user') {
      // Keep full user text; truncate tool_result to 200 chars
      for (const b of blocks) {
        if (b.type === 'text' && b.text?.trim()) {
          lines.push(`USER: ${b.text.trim()}`);
        } else if (b.type === 'tool_result') {
          const content = Array.isArray(b.content)
            ? b.content.filter(x => x.type === 'text').map(x => x.text).join(' ')
            : (b.content || '');
          if (content.trim()) lines.push(`TOOL_RESULT: ${content.trim().slice(0, 200)}`);
        }
      }
    } else if (m.role === 'assistant') {
      // Keep assistant text blocks; skip tool_use blocks (they're noisy)
      const text = blocks.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
      if (text) lines.push(`ASSISTANT: ${text}`);
    }
  }

  // Limit total size: keep last 6000 chars worth of lines
  const joined = lines.join('\n');
  return joined.length > 6000 ? joined.slice(-6000) : joined;
}

main().catch(e => {
  console.error('[fragcap]', e.message);
  process.exit(0);
});
