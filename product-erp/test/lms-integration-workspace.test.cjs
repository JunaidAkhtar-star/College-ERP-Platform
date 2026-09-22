const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('LMS workspace provides sync profiles, history and governed grade review', () => {
  const page = read('src/features/role-wise-features/lms-integration/components/LmsIntegrationPage.tsx');
  assert.match(page, /Run full synchronization/);
  assert.match(page, /Sync history/);
  assert.match(page, /Imported grades awaiting review/);
  assert.match(page, /Apply through grading history/);
  assert.match(page, /type="departments"/);
  assert.match(page, /Optional LTI 1\.3 trust metadata/);
  assert.doesNotMatch(page, /Enter department ID|MongoDB|ObjectId/i);
});

test('LMS providers can be configured and workspace is connected to academics', () => {
  const connectors = read('src/features/role-wise-features/settings/components/AvailableConnectorsSection.tsx');
  assert.match(connectors, /canvas_lms/);
  assert.match(connectors, /HTTPS LMS integration endpoint/);
  assert.match(read('src/shared/components/AcademicWorkflowBar.tsx'), /route: 'lms-integration'/);
});

test('Coursera onboarding and operational health are visible without fake success', () => {
  const settings = read(
    'src/features/role-wise-features/settings/components/AvailableConnectorsSection.tsx',
  );
  const workspace = read(
    'src/features/role-wise-features/lms-integration/components/LmsIntegrationPage.tsx',
  );
  assert.match(settings, /'coursera'/);
  assert.match(settings, /Coursera organization ID/);
  assert.match(workspace, /Coursera for Campus/);
  assert.match(workspace, /Runs requiring attention/);
  assert.match(workspace, /Latest issue/);
  assert.match(workspace, /Automatic synchronization/);
  assert.match(workspace, /Retry failed synchronization/);
  assert.match(workspace, /Edit integration profile/);
});

test('course discovery, dynamic enrollment, progress and credentials are understandable', () => {
  const workspace = read(
    'src/features/role-wise-features/lms-integration/components/LmsIntegrationPage.tsx',
  );
  const studentProfile = read(
    'src/features/role-wise-features/student-profile/components/StudentProfilePage.tsx',
  );
  const placement = read(
    'src/features/role-wise-features/placement/components/PlacementPage.tsx',
  );
  assert.match(workspace, /Provider courses/);
  assert.match(workspace, /type="students"/);
  assert.match(workspace, /Student learning progress/);
  assert.match(workspace, /Certificates & badges/);
  assert.match(workspace, /Synchronize provider course catalogue/);
  assert.match(workspace, /Synchronize progress and credentials/);
  assert.doesNotMatch(workspace, /Enter student ID|MongoDB|ObjectId/i);
  assert.match(studentProfile, /lms-integration\/credentials\/me/);
  assert.match(studentProfile, /Verify credential/);
  assert.match(placement, /Verified learning credentials/);
  assert.match(placement, /lms-integration\/credentials\/me/);
});
