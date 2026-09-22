const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("platform providers are encrypted, tested and readiness-gated", () => {
  const model = read("server/models/platform-integration.model.ts");
  const service = read("server/services/platform-integration.service.ts");
  const backup = read("server/services/tenant-backup.service.ts");
  const chat = read("server/controllers/chat.controller.ts");
  const cloudinary = read("server/services/cloudinary-client.service.ts");
  const email = read("server/email/email.service.ts");
  const firebase = read("server/utils/fcm.util.ts");
  const envExample = read(".env.example");

  assert.match(model, /secretCiphertext.*select: false/);
  assert.match(service, /cryptoUtil\.encrypt\(suppliedSecret\)/);
  assert.match(service, /row\.status !== "healthy"/);
  assert.match(backup, /platformIntegrationService\.credentials.*"google_drive"/s);
  assert.match(chat, /platformIntegrationService\.credentials.*"agora"/s);
  assert.match(cloudinary, /platformIntegrationService\.credentials.*"cloudinary"/s);
  assert.match(email, /platformIntegrationService\.credentials.*"smtp"/s);
  assert.match(firebase, /platformIntegrationService\.credentials.*"firebase"/s);
  assert.doesNotMatch(cloudinary, /configs\.CLOUDINARY_/);
  assert.doesNotMatch(email, /configs\.SMTP_/);
  assert.doesNotMatch(firebase, /configs\.FIREBASE_/);
  assert.doesNotMatch(envExample, /GOOGLE_DRIVE_CLIENT_(?:ID|SECRET)/);
  assert.doesNotMatch(
    envExample,
    /(?:CLOUDINARY_|SMTP_(?:HOST|PASS)|FIREBASE_PROJECT_ID|RAZORPAY_KEY_|AGORA_APP_)/,
  );
});
