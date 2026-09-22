const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("refresh-token validation explicitly loads hidden active sessions", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "server", "services", "auth.service.ts"),
    "utf8",
  );

  const refreshMethod = source.slice(
    source.indexOf("async refreshToken("),
    source.indexOf("/**\n   * Send email OTP", source.indexOf("async refreshToken(")),
  );

  assert.match(refreshMethod, /findByIdWithSessions\(payload\.userId\)/);
  assert.doesNotMatch(refreshMethod, /findById\(payload\.userId\)/);
});

test("MFA and refresh role IDs accept assigned system roles without treating them as custom roles", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "server", "services", "auth.service.ts"),
    "utf8",
  );
  const resolver = source.slice(
    source.indexOf("async function resolveRole"),
    source.indexOf("async function buildRolePayload"),
  );

  assert.match(resolver, /roleRepository\.findById\(selected\)/);
  assert.match(resolver, /roleById\.isSystem && user\.roles\.includes\(roleById\.baseRole/);
  assert.match(resolver, /user\.customRoleIds/);
  assert.match(resolver, /roleById\.isActive === false/);
});

test("refresh rotation is atomic and tolerates an interrupted hard reload briefly", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "..", "server", "services", "auth.service.ts"),
    "utf8",
  );
  const repository = fs.readFileSync(
    path.join(__dirname, "..", "server", "repositories", "user.repository.ts"),
    "utf8",
  );
  const rotationMethod = repository.slice(
    repository.indexOf("async rotateSession("),
    repository.indexOf("pruneRotatedSessions(", repository.indexOf("async rotateSession(")),
  );
  const model = fs.readFileSync(
    path.join(__dirname, "..", "server", "models", "user.model.ts"),
    "utf8",
  );

  assert.match(service, /REFRESH_ROTATION_GRACE_MS = 30_000/);
  assert.match(service, /rotateSession\(user\._id, payload\.jti, candidateJti, now\)/);
  assert.match(service, /predecessor\.rotatedToJti/);
  assert.match(repository, /async rotateSession/);
  assert.match(repository, /rotatedAt: \{ \$exists: false \}/);
  assert.match(repository, /updatePipeline: true/);
  assert.match(rotationMethod, /\$map/);
  assert.match(rotationMethod, /\$concatArrays/);
  assert.doesNotMatch(rotationMethod, /\$push/);
  assert.doesNotMatch(rotationMethod, /arrayFilters/);
  assert.match(model, /rotatedToJti/);
});
