const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function typescriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(fullPath);
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

test('environment template documents every deployer-controlled variable', () => {
  const variables = new Set();
  for (const file of typescriptFiles(path.join(root, 'server'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) variables.add(match[1]);
  }

  // K_SERVICE is injected by Google Cloud Run and is not deployer-configured.
  variables.delete('K_SERVICE');
  const documented = new Set(
    [...read('.env.example').matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]),
  );
  const missing = [...variables].filter((name) => !documented.has(name)).sort();
  assert.deepEqual(missing, []);
});

test('chat attachments are format and content-signature validated', () => {
  const source = read('server/utils/upload.util.ts');
  const chatMethod = source.slice(source.indexOf('async uploadChatAttachment'));
  assert.match(chatMethod, /resolveUploadExtension\(file,\s*ALLOWED_CHAT_FORMATS\)/);
  assert.match(chatMethod, /assertMagicBytes\(file,\s*ext\)/);
  assert.match(chatMethod, /MAX_CHAT_SIZE_MB/);
});

test('payment webhooks use constant-time signatures and idempotent event storage', () => {
  const source = read('server/services/tenant-integration.service.ts');
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /TenantPaymentWebhookEventModel\.findOne/);
  assert.match(source, /TenantPaymentWebhookEventModel\.findOneAndUpdate/);
});
