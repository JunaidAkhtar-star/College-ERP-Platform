const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("human-facing India dates always preserve two-digit day and month", () => {
  const { formatIndiaDate } = require(path.join(root, "build/utils/date.util.js"));
  assert.equal(formatIndiaDate("2026-08-01T06:00:00.000Z"), "01/08/2026");
  assert.equal(formatIndiaDate("2026-01-08T06:00:00.000Z"), "08/01/2026");
});

test("PDF and email rendering share the governed date formatter", () => {
  for (const file of ["server/pdf/pdf.service.ts", "server/email/email.service.ts"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /formatIndiaDate/);
  }
});

test("business services do not use locale-default India dates", () => {
  const directories = ["server/services", "server/controllers", "server/jobs", "server/routes"];
  const offenders = [];
  const visit = (entry) => {
    for (const name of fs.readdirSync(entry)) {
      const target = path.join(entry, name);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) visit(target);
      else if (name.endsWith(".ts")) {
        const source = fs.readFileSync(target, "utf8");
        if (/toLocaleDateString\(["']en-IN["']\)/.test(source)) {
          offenders.push(path.relative(root, target));
        }
      }
    }
  };
  directories.forEach((directory) => visit(path.join(root, directory)));
  assert.deepEqual(offenders, []);
});
