const assert = require("node:assert/strict");
const test = require("node:test");
const { validateAdmissionAcademicRecords } = require("../build/services/admission.service.js");

const tenth = {
  level: "10th",
  boardOrUniversity: "BSE Odisha",
  instituteName: "School",
  yearOfPassing: 2020,
  percentageOfMarks: 80,
};
const higher = {
  level: "12th_or_diploma",
  boardOrUniversity: "CHSE Odisha",
  instituteName: "College",
  yearOfPassing: 2022,
  percentageOfMarks: 75,
};
const degree = {
  level: "degree",
  boardOrUniversity: "University",
  instituteName: "Degree College",
  yearOfPassing: 2025,
  percentageOfMarks: 70,
};

test("requires a complete ordered academic history for admission", () => {
  assert.doesNotThrow(() => validateAdmissionAcademicRecords([tenth, higher], false));
  assert.throws(() => validateAdmissionAcademicRecords([tenth], false), /Both 10th and 12th/);
  assert.throws(
    () => validateAdmissionAcademicRecords([tenth, { ...higher, yearOfPassing: 2019 }], false),
    /greater than Class 10th/,
  );
});

test("requires degree evidence for postgraduate admission", () => {
  assert.throws(
    () => validateAdmissionAcademicRecords([tenth, higher], true),
    /degree academic record/,
  );
  assert.doesNotThrow(() => validateAdmissionAcademicRecords([tenth, higher, degree], true));
  assert.throws(
    () => validateAdmissionAcademicRecords([tenth, higher, higher], false),
    /Only one 12th_or_diploma/,
  );
});
