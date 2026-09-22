const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("notification inbox exposes a visibility-scoped bulk read action", () => {
  const routes = read("server/routes/notification.routes.ts");
  const service = read("server/services/notification.service.ts");

  assert.match(routes, /router\.post\("\/read-all", auth/);
  assert.match(service, /markAllRead/);
  assert.match(service, /notificationRepository\.getForUser/);
  assert.match(service, /notificationRepository\.markRead/);
});
