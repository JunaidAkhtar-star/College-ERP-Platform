const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveUploadExtension } = require("../build/utils/upload.util.js");

const allowed = ["pdf", "jpg", "jpeg", "png", "webp", "ico"];

test("resolves WebP from a normal case-insensitive filename", () => {
  assert.equal(
    resolveUploadExtension({ name: "College Logo.WEBP", mimetype: "image/webp" }, allowed),
    "webp",
  );
});

test("uses a supported MIME fallback when the browser filename has no extension", () => {
  assert.equal(resolveUploadExtension({ name: "blob", mimetype: "image/webp" }, allowed), "webp");
});

test("accepts a browser favicon from its ICO MIME type", () => {
  assert.equal(
    resolveUploadExtension({ name: "favicon", mimetype: "image/vnd.microsoft.icon" }, allowed),
    "ico",
  );
});

test("rejects formats that are absent from both filename and MIME allowlists", () => {
  assert.throws(
    () => resolveUploadExtension({ name: "image.svg", mimetype: "image/svg+xml" }, allowed),
    /Invalid file format/,
  );
});
