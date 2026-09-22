const assert = require("node:assert/strict");
const test = require("node:test");
const { validateMaterialSource } = require("../build/services/study-material.service.js");

test("requires an appropriate source for every study-material type", () => {
  assert.deepEqual(validateMaterialSource("link", undefined, "https://example.com/lesson"), {
    fileUrl: undefined,
    externalLink: "https://example.com/lesson",
  });
  assert.equal(
    validateMaterialSource("pdf", "https://cdn.example.com/lesson.pdf").fileUrl,
    "https://cdn.example.com/lesson.pdf",
  );
  assert.throws(() => validateMaterialSource("link"), /require an external link/);
  assert.throws(() => validateMaterialSource("pdf"), /file URL or external link/);
});

test("rejects executable and malformed study-material links", () => {
  assert.throws(
    () => validateMaterialSource("link", undefined, "javascript:alert(1)"),
    /HTTP or HTTPS/,
  );
  assert.throws(() => validateMaterialSource("video", "not a url"), /valid URL/);
});
