const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("mapped routes authorize by module action before legacy role names", () => {
  const source = read("server/middlewares/auth.middleware.ts");
  const guard = source.slice(
    source.indexOf("export function requireRoles"),
    source.indexOf("export function requireAnyRole"),
  );

  assert.match(guard, /const required = permissionForRequest\(req\)/);
  assert.match(guard, /if \(required\)/);
  assert.match(guard, /hasPermission\(req\.permissions, required\.module, required\.action\)/);
  assert.ok(
    guard.indexOf("if (required)") < guard.indexOf("roles.includes"),
    "permission authorization must precede the unmapped-route role fallback",
  );
});

test("permission-owned navigation does not depend on legacy requiredRoles", () => {
  const source = read("server/services/nav.service.ts");

  assert.match(source, /permissionModulesForNavHref\(l\.href\)/);
  assert.match(source, /permission\.actions\.includes\(PermissionAction\.VIEW\)/);
  assert.match(source, /permissionModules\.length === 0/);
});

test("every seeded product menu has a permission owner except account self-service", () => {
  const seed = read("server/scripts/seed.ts");
  const navStart = seed.indexOf("const NAV:");
  const navEnd = seed.indexOf("// Seed helpers", navStart);
  const hrefs = [...seed.slice(navStart, navEnd).matchAll(/href:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  const routePermissions = read("server/constants/route-permissions.ts");
  const mapStart = routePermissions.indexOf("NAV_HREF_MODULES");
  const mapEnd = routePermissions.indexOf("export function permissionModulesForNavHref", mapStart);
  const owners = [
    ...routePermissions.slice(mapStart, mapEnd).matchAll(/^\s*"([^"]+)":/gm),
  ].map((match) => match[1]);
  const selfService = new Set(["/profile", "/settings"]);
  const missing = hrefs.filter(
    (href) =>
      !selfService.has(href) &&
      !owners.some((owner) => href === owner || href.startsWith(`${owner}/`)),
  );

  assert.deepEqual(missing, []);
});
