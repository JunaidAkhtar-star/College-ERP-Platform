const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const bcrypt = require("bcryptjs");

const root = path.join(__dirname, "..");

test("password verification is correct through the bounded worker pool", async (t) => {
  const { passwordVerifier } = require(
    path.join(root, "build", "utils", "password-verifier.util.js"),
  );
  t.after(() => passwordVerifier.close());
  const hash = await bcrypt.hash("correct horse battery staple", 6);

  const [valid, invalid] = await Promise.all([
    passwordVerifier.compare("correct horse battery staple", hash),
    passwordVerifier.compare("incorrect", hash),
  ]);

  assert.equal(valid, true);
  assert.equal(invalid, false);
});

test("login avoids redundant role queries and overlaps independent persistence", () => {
  const source = fs.readFileSync(path.join(root, "server", "services", "auth.service.ts"), "utf8");
  const issueTokens = source.slice(
    source.indexOf("async issueLoginTokens("),
    source.indexOf("async refreshToken(", source.indexOf("async issueLoginTokens(")),
  );

  assert.doesNotMatch(issueTokens, /roleRepository\.findById/);
  assert.match(issueTokens, /Promise\.all\(\[/);
  assert.match(issueTokens, /sessionUpdate/);
  assert.match(issueTokens, /auditWrite/);
  assert.match(issueTokens, /platformLogin\s*\? Promise\.resolve\(null\)/);
  assert.match(source, /if \(!\(user\.customRoleIds \?\? \[\]\)\.length\) return/);
});

test("auth throttling is scoped by normalized IP, tenant and login identity", () => {
  const source = fs.readFileSync(
    path.join(root, "server", "middlewares", "rate-limit.middleware.ts"),
    "utf8",
  );

  assert.match(source, /ipKeyGenerator\(req\.ip/);
  assert.match(source, /x-tenant-id/);
  assert.match(source, /req\.body\?\.identifier/);
});

test("tenant login resolves governed student and faculty identifiers", () => {
  const repository = fs.readFileSync(
    path.join(root, "server", "repositories", "user.repository.ts"),
    "utf8",
  );
  const routes = fs.readFileSync(path.join(root, "server", "routes", "auth.routes.ts"), "utf8");

  assert.match(repository, /studentId: institutionalId/);
  assert.match(repository, /facultyId: institutionalId/);
  assert.match(repository, /registrationNumber: institutionalId/);
  assert.match(repository, /roles: SystemRole\.STUDENT/);
  assert.match(routes, /body\("identifier"\)/);
});
