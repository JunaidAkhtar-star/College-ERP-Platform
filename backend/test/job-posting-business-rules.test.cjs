const assert = require("node:assert/strict");
const test = require("node:test");
const {
  evaluateJobEligibility,
  normalizeJobPosting,
} = require("../build/services/job-posting.service.js");

const posting = {
  eligiblePrograms: ["B.Tech"],
  eligibleBranches: ["CSE"],
  eligibleBatches: ["2026"],
  minCgpa: 7,
  maxBacklogs: 0,
};
const profile = {
  program: "B.Tech",
  branch: "CSE",
  batch: "2026",
  cgpa: 8,
  activeBacklogs: 0,
  isEligibleForPlacement: true,
  resumeUrl: "https://files.example/resume.pdf",
};

test("evaluates all authoritative job eligibility fields", () => {
  assert.deepEqual(evaluateJobEligibility(posting, profile), { eligible: true, reasons: [] });
  const result = evaluateJobEligibility(posting, {
    ...profile,
    branch: "ECE",
    cgpa: 6,
    activeBacklogs: 1,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.length, 3);
});

test("normalizes a publishable internal job and salary range", () => {
  const normalized = normalizeJobPosting(
    {
      companyName: " Example Ltd ",
      jobTitle: "Engineer",
      jobType: "Full Time",
      location: "Bengaluru",
      description: "Build reliable products",
      applicationDeadline: "2099-08-01T00:00:00.000Z",
      applyMode: "internal",
      salaryMin: 8,
      salaryMax: 10,
      eligibleBranches: ["CSE", "CSE"],
    },
    true,
  );
  assert.equal(normalized.companyName, "Example Ltd");
  assert.deepEqual(normalized.eligibleBranches, ["CSE"]);
  assert.equal(normalized.externalApplyLink, undefined);
});

test("rejects invalid external destinations and salary ranges", () => {
  const base = {
    companyName: "Example Ltd",
    jobTitle: "Engineer",
    jobType: "Full Time",
    location: "Bengaluru",
    description: "Build reliable products",
    applicationDeadline: "2099-08-01T00:00:00.000Z",
    applyMode: "external",
  };
  assert.throws(
    () => normalizeJobPosting({ ...base, externalApplyLink: "javascript:alert(1)" }),
    /external application link/i,
  );
  assert.throws(
    () =>
      normalizeJobPosting({
        ...base,
        externalApplyLink: "https://example.com",
        salaryMin: 12,
        salaryMax: 10,
      }),
    /Minimum salary cannot exceed/,
  );
});
