#!/usr/bin/env node
// Blocks commits that contain secrets or private data files.
// Usage: node scripts/check-secrets.mjs          (staged files, used by pre-commit)
//        node scripts/check-secrets.mjs --all    (all tracked files, used by CI)
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

const all = process.argv.includes('--all');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });
const files = (all ? git('ls-files') : git('diff', '--cached', '--name-only', '--diff-filter=ACMR'))
  .split('\n').filter(Boolean);

const BLOCKED_NAMES = [
  /(^|\/)\.env($|\.(?!example$))/,
  /\.(db|db-wal|db-shm|sqlite3?)$/,
  /\.(pem|key|p12|pfx)$/,
  /(^|\/)\.secrets\//,
  /(^|\/)cloudflare\.ini$/,
  /(^|\/)vapid.*\.json$/,
  /(^|\/)(data|backups)\//,
];

const PATTERNS = [
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Cloudflare token assignment', /dns_cloudflare_api_(token|key)\s*=\s*[^<\s]{20,}/],
  ['VAPID private key', /(vapid_?private|privateKey)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{40,}["']/i],
  ['generic secret assignment', /\b(secret|token|password|api_?key)\b["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/=]{24,}["']/i],
];

const ALLOW = /check-secrets\.mjs$/;
const problems = [];

for (const f of files) {
  if (BLOCKED_NAMES.some(r => r.test(f))) { problems.push(`${f}: file type must not be committed`); continue; }
  if (ALLOW.test(f) || !existsSync(f) || statSync(f).size > 2_000_000) continue;
  const text = readFileSync(f, 'utf8');
  if (text.includes('\0')) continue; // binary
  text.split('\n').forEach((line, i) => {
    if (line.includes('secret-scan: allow')) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) problems.push(`${f}:${i + 1}: possible ${name}`);
  });
}

if (problems.length) {
  console.error('\n✗ secret check failed:\n  ' + problems.join('\n  '));
  console.error('\nRemove the secret, or add "secret-scan: allow" to a line that is a known false positive.\n');
  process.exit(1);
}
console.log(`✓ secret check passed (${files.length} files)`);
