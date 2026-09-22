const assert = require("node:assert/strict");
const test = require("node:test");
const {
  alumniDonationJournalLines,
  cleanCareerUpdate,
  validateAcademicCompletion,
} = require("../build/services/alumni.service.js");

test("graduates only with every published passing semester and required credits", () => {
  const results = [1, 2, 3, 4].map((semester) => ({
    semester,
    result: "PASS",
    isPublished: true,
    totalCreditsEarned: 20,
  }));
  assert.deepEqual(
    validateAcademicCompletion({ totalSemesters: 4, totalCreditsRequired: 80, results }),
    { complete: true, missingSemesters: [], creditsEarned: 80 },
  );
  const failed = validateAcademicCompletion({
    totalSemesters: 4,
    totalCreditsRequired: 80,
    results: results.map((result) =>
      result.semester === 4 ? { ...result, result: "WITHHELD" } : result,
    ),
  });
  assert.equal(failed.complete, false);
  assert.deepEqual(failed.missingSemesters, [4]);
});

test("career outcomes require employer evidence and safe links", () => {
  assert.throws(() => cleanCareerUpdate({ isPlaced: true, package: 8 }), /Employer is required/);
  assert.throws(
    () => cleanCareerUpdate({ linkedinUrl: "javascript:alert(1)" }),
    /LinkedIn URL is invalid/,
  );
  const update = cleanCareerUpdate({
    isPlaced: true,
    currentEmployer: "Example Ltd",
    package: 8,
    skills: ["Node.js", "node.js"],
  });
  assert.deepEqual(update.skills, ["node.js"]);
});

test("posts alumni donations as balanced cash or bank income", () => {
  const lines = alumniDonationJournalLines({
    amount: 1000,
    paymentMethod: "online",
    alumniId: "507f1f77bcf86cd799439011",
  });
  assert.equal(lines[0].accountCode, "BANK");
  assert.equal(
    lines.reduce((sum, line) => sum + (line.debit ?? 0), 0),
    1000,
  );
  assert.equal(
    lines.reduce((sum, line) => sum + (line.credit ?? 0), 0),
    1000,
  );
});
