const assert = require("node:assert/strict");
const test = require("node:test");
const {
  evaluatePlacementDriveEligibility,
  validateAndNormalizePlacementDrive,
} = require("../build/services/placement.service.js");

const drive = {
  eligibilityCgpa: 7,
  eligibilityBacklogs: 0,
  eligiblePrograms: ["B.Tech"],
  eligibleBranches: ["CSE"],
  eligibleBatches: ["2023"],
  package: 8,
};

const profile = {
  cgpa: 8,
  activeBacklogs: 0,
  program: "B.Tech",
  branch: "CSE",
  batch: "2023",
  eligibilityStatus: "eligible",
  isEligibleForPlacement: true,
  isHigherPackageSeeking: false,
};

test("evaluates every authoritative drive eligibility rule", () => {
  assert.deepEqual(evaluatePlacementDriveEligibility(drive, profile), {
    eligible: true,
    reasons: [],
  });
  const failed = evaluatePlacementDriveEligibility(drive, {
    ...profile,
    cgpa: 6.5,
    activeBacklogs: 1,
    branch: "ECE",
  });
  assert.equal(failed.eligible, false);
  assert.equal(failed.reasons.length, 3);
});

test("requires a meaningful package increase for an already placed student", () => {
  const failed = evaluatePlacementDriveEligibility(drive, {
    ...profile,
    eligibilityStatus: "placed",
    isHigherPackageSeeking: true,
    placedPackage: 7,
  });
  assert.equal(failed.eligible, false);
  assert.match(failed.reasons.join(" "), /20% package increase/);
});

test("normalizes a valid drive and ordered selection rounds", () => {
  const normalized = validateAndNormalizePlacementDrive({
    academicYear: "2026-27",
    companyName: "Example Ltd",
    jobRole: "Engineer",
    venue: "Campus",
    package: 8,
    packageMax: 10,
    registrationStart: "2026-08-01",
    registrationEnd: "2026-08-10",
    driveDate: "2026-08-15",
    rounds: [
      { roundNo: 1, roundName: " Aptitude " },
      { roundNo: 2, roundName: "Technical" },
    ],
    eligiblePrograms: ["B.Tech", "B.Tech"],
  });
  assert.equal(normalized.status, "upcoming");
  assert.equal(normalized.rounds[0].roundName, "Aptitude");
  assert.deepEqual(normalized.eligiblePrograms, ["B.Tech"]);
});

test("rejects invalid registration windows, package ranges, and round ordering", () => {
  const base = {
    academicYear: "2026-27",
    companyName: "Example Ltd",
    jobRole: "Engineer",
    venue: "Campus",
    package: 8,
    registrationStart: "2026-08-01",
    registrationEnd: "2026-08-10",
    driveDate: "2026-08-15",
    rounds: [{ roundNo: 1, roundName: "Aptitude" }],
  };
  assert.throws(
    () => validateAndNormalizePlacementDrive({ ...base, registrationEnd: "2026-08-20" }),
    /Registration must close/,
  );
  assert.throws(
    () => validateAndNormalizePlacementDrive({ ...base, packageMax: 7 }),
    /package range/,
  );
  assert.throws(
    () =>
      validateAndNormalizePlacementDrive({
        ...base,
        rounds: [{ roundNo: 2, roundName: "Technical" }],
      }),
    /contiguous/,
  );
});
