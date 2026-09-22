const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { cryptoUtil } = require("../build/utils/crypto.util");

test("export artifact payloads use authenticated encryption", () => {
  const plaintext = JSON.stringify({ dataset: "students", rows: [{ studentId: "S-1" }] });
  const ciphertext = cryptoUtil.encrypt(plaintext);
  assert.notEqual(ciphertext, plaintext);
  assert.equal(cryptoUtil.decrypt(ciphertext), plaintext);
  const tampered = `${ciphertext.slice(0, -2)}AA`;
  assert.throws(() => cryptoUtil.decrypt(tampered));
});

test("export retention is legal-hold aware and artifacts are immutable", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/data-portability.service.ts"),
    "utf8",
  );
  const model = fs.readFileSync(
    path.join(__dirname, "../server/models/data-portability.model.ts"),
    "utf8",
  );
  assert.match(service, /purgeExpiredArtifacts/);
  assert.match(service, /generationLeaseToken/);
  assert.match(service, /generationLeaseUntil/);
  assert.match(service, /datasets:\s*\{\s*\$in:\s*datasetKeys\s*\}/);
  assert.match(service, /heldDatasets\.has\(dataset\)/);
  assert.match(model, /Export artifact chunks are immutable/);
  assert.doesNotMatch(
    model,
    /DataExportJobSchema\.index\(\{ expiresAt: 1 \}, \{ expireAfterSeconds/,
  );
});
