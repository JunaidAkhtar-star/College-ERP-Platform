const test = require("node:test");
const assert = require("node:assert/strict");
const { canTransitionDisciplineStatus } = require("../build/services/discipline.service.js");

test("discipline workflow accepts governed forward transitions", () => {
  assert.equal(canTransitionDisciplineStatus("reported", "triage"), true);
  assert.equal(canTransitionDisciplineStatus("investigation", "hearing"), true);
  assert.equal(canTransitionDisciplineStatus("decided", "appealed"), true);
});

test("discipline workflow blocks reopening terminal cases and invalid jumps", () => {
  assert.equal(canTransitionDisciplineStatus("reported", "decided"), false);
  assert.equal(canTransitionDisciplineStatus("closed", "investigation"), false);
  assert.equal(canTransitionDisciplineStatus("dismissed", "triage"), false);
});
