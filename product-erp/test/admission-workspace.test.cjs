const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Admissions pages expose the shared guided workspace', () => {
  for (const file of [
    'src/features/role-wise-features/admission/components/AdmissionPage.tsx',
    'src/features/role-wise-features/admission/components/InitiateApplicationPage.tsx',
    'src/features/role-wise-features/admission/components/ApplicationDetailPage.tsx',
    'src/features/role-wise-features/admission/components/ApplicationFormPage.tsx',
  ]) {
    assert.match(read(file), /AdmissionWorkflowBar/);
  }
});

test('Admissions uses dynamic academic years and programmes', () => {
  const initiate = read(
    'src/features/role-wise-features/admission/components/InitiateApplicationPage.tsx',
  );
  const form = read('src/features/role-wise-features/admission/components/ApplicationFormPage.tsx');
  const list = read('src/features/role-wise-features/admission/components/AdmissionPage.tsx');
  assert.match(initiate, /type="academicYears"/);
  assert.match(initiate, /type="programs"/);
  assert.match(form, /type="academicYears"/);
  assert.match(form, /type="programs"/);
  assert.match(list, /type="academicYears"/);
  assert.match(list, /type="programs"/);
  assert.doesNotMatch(`${initiate}\n${form}`, /const PROGRAMS/);
});

test('Direct admission waits for a programme and offers optional filtered branches', () => {
  const initiate = read(
    'src/features/role-wise-features/admission/components/InitiateApplicationPage.tsx',
  );
  const form = read('src/features/role-wise-features/admission/components/ApplicationFormPage.tsx');
  assert.match(initiate, /label="Branch \(Optional\)"/);
  assert.match(initiate, /program: formik\.values\.programPreference/);
  assert.match(initiate, /preferredDepartmentId: values\.preferredDepartmentId \|\| undefined/);
  assert.match(form, /Preferred Branch \(Optional\)/);
  assert.match(form, /Programme \/ Curriculum/);
  assert.ok(form.indexOf('Programme &amp; Branch') < form.indexOf('{step === 1 &&'));
  assert.match(form, /formik\.values\.programPreferences\[0\]/);
  assert.doesNotMatch(
    form,
    /programPreference: formik\.values\.programPreferences\[0\] \|\| 'B\.Tech'/,
  );
  assert.match(form, /prefilledIdRef\.current = createdId/);
  assert.match(form, /currentUrl\.searchParams\.set\('appId', createdId\)/);
  assert.match(form, /admission\/applications\/\$\{createdId\}/);
  assert.match(form, /Send login credentials to the student/);
  assert.match(form, /sendEmail: formik\.values\.sendCredentialsEmail/);
  assert.match(form, /sendCredentialsEmail: false/);
  assert.match(form, /!selfService && !activeAppId &&/);
  assert.match(form, /\(selfService \|\| activeAppId\) &&/);
  assert.match(form, /Review or update the programme details linked to this application/);
});

test('Initiation confirmation accurately reports optional credential email delivery', () => {
  const initiate = read(
    'src/features/role-wise-features/admission/components/InitiateApplicationPage.tsx',
  );
  assert.match(initiate, /result\.credentialsEmailRequested/);
  assert.match(initiate, /sendEmail: false/);
  assert.match(initiate, /ERP Student ID, temporary password and admission portal instructions/);
  assert.match(initiate, /No email will be sent/);
  assert.match(initiate, /Email delivery was not requested/);
  assert.match(initiate, /it cannot be\s+recovered later/);
  assert.doesNotMatch(initiate, /Temporary Password \(dev only\)/);
});

test('admission initiation previews the backend-derived programme identifier format', () => {
  const initiate = read(
    'src/features/role-wise-features/admission/components/InitiateApplicationPage.tsx',
  );
  assert.match(initiate, /regularAdmissionCode/);
  assert.match(initiate, /lateralAdmissionCode/);
  assert.match(initiate, /final sequence is generated atomically/i);
});

test('Admissions list uses one server-backed search control', () => {
  const source = read('src/features/role-wise-features/admission/components/AdmissionPage.tsx');
  assert.match(source, /showSearch=\{false\}/);
  assert.doesNotMatch(source, /options=\{\{ search: true/);
});

test('Admissions table uses the shared toolbar and three-dot row actions', () => {
  const source = read('src/features/role-wise-features/admission/components/AdmissionPage.tsx');
  assert.match(source, /title="Admission Applications"/);
  assert.match(source, /description="Review applicant details/);
  assert.match(source, /onRefresh=\{\(\) => void mutate\(\)\}/);
  assert.match(source, /actionsType: 'dropdown'/);
  assert.match(source, /tooltip: 'Edit application form'/);
});

test('Admissions table status column only displays the status badge', () => {
  const admissionPage = read(
    'src/features/role-wise-features/admission/components/AdmissionPage.tsx',
  );
  assert.match(admissionPage, /title: 'Status'/);
  assert.doesNotMatch(admissionPage, /Status & Audit/);
  assert.doesNotMatch(admissionPage, /Enrolled by/);
  assert.doesNotMatch(admissionPage, /Approved by/);
});

test('Admissions table centers every column except the applicant', () => {
  const admissionPage = read(
    'src/features/role-wise-features/admission/components/AdmissionPage.tsx',
  );
  assert.equal((admissionPage.match(/headerClassName: '!text-center'/g) ?? []).length, 4);
  assert.equal((admissionPage.match(/cellClassName: '!text-center'/g) ?? []).length, 4);
});

test('Authorized admission staff can edit submitted applications before review', () => {
  const detail = read(
    'src/features/role-wise-features/admission/components/ApplicationDetailPage.tsx',
  );
  assert.match(detail, /app\.status === 'submitted' && canOperate/);
  assert.match(detail, /Edit Submitted Form/);
});

test('Application detail presents progress first and a professional light summary', () => {
  const detail = read(
    'src/features/role-wise-features/admission/components/ApplicationDetailPage.tsx',
  );
  assert.match(detail, /className="overflow-hidden rounded-2xl bg-white"/);
  assert.match(detail, /xl:grid-cols-\[minmax\(0,2fr\)_minmax\(0,3fr\)\]/);
  assert.match(detail, /className="mt-4 grid grid-cols-1 gap-3"/);
  assert.doesNotMatch(detail, /bg-slate-950 text-white/);
  assert.match(detail, /Admission application/);
  assert.match(detail, /Programme Preferences/);
  assert.doesNotMatch(detail, /sectionLinks/);
  assert.ok(detail.indexOf('Application Progress') < detail.indexOf('<motion.header'));
  for (const sectionId of ['sec-profile', 'sec-documents', 'sec-payment', 'sec-approval']) {
    assert.match(detail, new RegExp(`id="${sectionId}"`));
  }
});

test('Application detail removes repeated identity fields and provides a document review dashboard', () => {
  const detail = read(
    'src/features/role-wise-features/admission/components/ApplicationDetailPage.tsx',
  );
  assert.doesNotMatch(detail, /InfoRow label="Full Name"/);
  assert.doesNotMatch(detail, /InfoRow label="Father's Name"/);
  assert.doesNotMatch(detail, /InfoRow label="Mother's Name"/);
  assert.match(detail, /label="Guardian"/);
  assert.match(detail, /Needs action/);
  assert.match(detail, /Verification controls/);
  assert.match(detail, /Verify uploaded/);
});

test('Enrolled applications replace progress guidance with completion metadata', () => {
  const detail = read(
    'src/features/role-wise-features/admission/components/ApplicationDetailPage.tsx',
  );
  assert.match(detail, /app\.status === 'enrolled' \?/);
  assert.match(detail, /Enrolled — Admission Complete/);
  assert.match(detail, /Enrollment date &amp; time/);
  assert.match(detail, /app\.registrationNumber/);
  assert.match(detail, /Enrolled by:<\/span>/);
  assert.match(detail, /break-words font-medium">\{enrolledByName\}/);
  assert.match(detail, /Need to update student details\?/);
  assert.match(detail, /Go to Student Management/);
  assert.match(detail, /app\.status !== 'enrolled'/);
});

test('Draft applicants reach the form before post-enrollment portal gates', () => {
  const portal = read('src/app/[tenant]/admission-portal/page.tsx');
  const draftGate = portal.indexOf("if (app.status === 'draft')");
  const registrationGate = portal.indexOf("app.status === 'enrolled'");
  assert.ok(draftGate >= 0);
  assert.ok(registrationGate > draftGate);
  assert.match(portal, /Registration number and section allotment are post-enrollment gates only/);
});
