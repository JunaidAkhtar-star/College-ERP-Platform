const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("browser push is explicit opt-in and token removal remains available", () => {
  const user = read("server/models/user.model.ts");
  const socket = read("server/socket/socket.gateway.ts");
  const controller = read("server/controllers/notification.controller.ts");

  assert.match(user, /push: \{ type: Boolean, default: false \}/);
  assert.match(socket, /prefs\?\.push === true/);
  assert.match(controller, /\$pull: \{\s*fcmTokens:/);
  assert.match(controller, /deviceId/);
  assert.match(controller, /"notificationPreferences\.push": true/);
});

test("Firebase client delivery configuration includes tenant-facing institution branding", () => {
  const service = read("server/services/tenant-integration.service.ts");
  assert.match(service, /InstitutionSettingModel/);
  assert.match(service, /institutionName: institution\?\.name/);
  assert.match(service, /institutionLogoUrl: institution\?\.logoUrl/);
});

test("push delivery deduplicates recipients and physical FCM tokens", () => {
  const user = read("server/models/user.model.ts");
  const notificationService = read("server/services/notification.service.ts");
  const fcm = read("server/utils/fcm.util.ts");

  assert.match(notificationService, /let targetUserIds = Array\.from\(\s*new Set/);
  assert.match(fcm, /tokenEntries/);
  assert.match(user, /fcmTokens: \{ type: \[fcmDeviceTokenSchema\], default: \[\] \}/);
  assert.match(fcm, /deviceTokens\.length/);
  assert.match(fcm, /const uniqueTokens = Array\.from\(new Set/);
});

test("normal and scheduled delivery honor channels and remove invalid device tokens", () => {
  const notificationService = read("server/services/notification.service.ts");
  const socket = read("server/socket/socket.gateway.ts");
  const fcm = read("server/utils/fcm.util.ts");
  assert.match(notificationService, /channels\.includes\(NotificationChannel\.PUSH\)/);
  assert.match(notificationService, /processScheduled/);
  assert.match(notificationService, /pushNotification\(/);
  assert.match(socket, /channels\.push !== false/);
  assert.match(socket, /invalidTokens/);
  assert.match(fcm, /registration-token-not-registered/);
  assert.match(fcm, /platform === "web" \? \{ token, data \}/);
});
