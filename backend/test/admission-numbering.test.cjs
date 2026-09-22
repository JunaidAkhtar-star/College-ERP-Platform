const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const ids = fs.readFileSync(path.join(root, 'server/utils/id.util.ts'), 'utf8');
const admission = fs.readFileSync(path.join(root, 'server/services/admission.service.ts'), 'utf8');
const search = fs.readFileSync(path.join(root, 'server/routes/search.routes.ts'), 'utf8');
const { deriveStudentAdmissionCode } = require('../build/utils/id.util.js');

test('admission identifiers preserve B.Tech type codes and derive other programme codes', () => {
  assert.match(ids, /deriveStudentAdmissionCode/);
  assert.match(ids, /"BTECH"/);
  assert.match(ids, /admissionType === "lateral_entry" \? "LE" : "RE"/);
  assert.match(ids, /nextSeq\(`student:\$\{year\}:\$\{code\}`\)/);
  assert.match(ids, /26MCA001/);
  assert.equal(deriveStudentAdmissionCode('B.Tech → Bachelor of Technology', 'regular'), 'RE');
  assert.equal(deriveStudentAdmissionCode('B.Tech → Bachelor of Technology', 'lateral_entry'), 'LE');
  assert.equal(deriveStudentAdmissionCode('MCA → Master of Computer Applications', 'regular'), 'MCA');
  assert.equal(deriveStudentAdmissionCode('MBA → Master of Business Administration', 'regular'), 'MBA');
  assert.equal(deriveStudentAdmissionCode('M.Tech → Master of Technology', 'regular'), 'MTECH');
  assert.equal(deriveStudentAdmissionCode('Bachelor of Arts', 'regular'), 'BA');
  assert.match(search, /regularAdmissionCode/);
  assert.match(search, /lateralAdmissionCode/);
});

test('every admission creation path supplies programme context and preserves a stable identity', () => {
  assert.match(admission, /if \(!selectedProgramme\) throw new BadRequest/);
  assert.doesNotMatch(admission, /programPreferences\?\.\[0\] \?\? "B\.Tech"/);
  assert.doesNotMatch(ids, /programme = "B\.Tech"/);
  assert.match(admission, /data\.programPreference/);
  assert.match(admission, /stableApplicationId/);
  assert.match(admission, /applicationNumber: studentId/);
});
