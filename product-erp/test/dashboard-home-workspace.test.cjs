const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('dashboard home renders only the active role content and handles failures', () => {
  const dashboard = read('src/features/role-wise-features/dashboard/components/DashboardPage.tsx');

  assert.doesNotMatch(dashboard, /useNav\(\)/);
  assert.doesNotMatch(dashboard, /Your workspace/);
  assert.doesNotMatch(dashboard, /Pages available to your active role and institution plan/);
  assert.match(dashboard, /ROLE_VIEW_MAP\[activeRole\] \?\? CommonRoleDashboard/);
  assert.match(dashboard, /hostel_warden: HostelWardenDashboard/);
  assert.match(dashboard, /Dashboard could not be loaded/);
  assert.match(dashboard, /void mutate\(\)/);
  assert.doesNotMatch(dashboard, /ROLE_VIEW_MAP\[activeRole\] \?\? AdminView/);
  assert.match(dashboard, /className="role-dashboard w-full"/);
});

test('role dashboards receive a responsive stationary illustrated hero without duplicating admin heroes', () => {
  const page = read('src/features/role-wise-features/dashboard/components/DashboardPage.tsx');
  const hero = read('src/features/role-wise-features/dashboard/components/DashboardRoleHero.tsx');

  assert.match(page, /<DashboardRoleHero role=\{activeRole\} \/>/);
  assert.match(page, /\['admin', 'super_admin', 'faculty', 'hod'\]\.includes\(activeRole\)/);
  assert.match(page, /<Dashboard d=\{response\?\.data \?\? \{\}\} \/>/);
  assert.match(hero, /\/dashboard\/erp-role-hero\.png/);
  assert.match(hero, /bg-gradient-to-r from-sky-50 via-white to-violet-50/);
  assert.doesNotMatch(hero, /animate=\{\{ y:/);
  assert.match(hero, /sm:w-\[48%\]/);
  assert.doesNotMatch(hero, /bg-(?:black|slate-9|gray-9|zinc-9|neutral-9)/);
});

test('institution KPI cards use related artwork and Indian rupee finance semantics', () => {
  const commandCenter = read(
    'src/features/role-wise-features/dashboard/components/institution-admin/InstitutionCommandCenter.tsx',
  );

  for (const asset of ['students', 'faculty', 'staff', 'subjects', 'admissions', 'fees-rupee']) {
    assert.match(commandCenter, new RegExp(`/dashboard/kpis/${asset}\\.png`));
  }
  assert.match(commandCenter, /IndianRupee/);
  assert.doesNotMatch(commandCenter, /CircleDollarSign/);
  assert.equal((commandCenter.match(/surface: 'bg-white'/g) ?? []).length, 6);
});

test('all semantic dashboard interactions expose pointer and disabled cursors globally', () => {
  const styles = read('src/app/globals.css');

  assert.match(styles, /\.role-dashboard[\s\S]*?button:not\(:disabled\)/);
  assert.match(styles, /\[role='button'\]:not\(\[aria-disabled='true'\]\)/);
  assert.match(styles, /\.role-dashboard[\s\S]*?cursor: pointer/);
  assert.match(styles, /button:disabled[\s\S]*?cursor: not-allowed/);
});

test('every system role has an intentional dashboard view', () => {
  const dashboard = read('src/features/role-wise-features/dashboard/components/DashboardPage.tsx');
  const roles = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'administration_office',
    'assistant_administration_officer',
    'hod',
    'faculty',
    'student',
    'parent',
    'examination_cell',
    'iqac_team',
    'iqac_naac',
    'scholarship_cell',
    'library_staff',
    'hostel_warden',
    'placement_cell',
    'hr_department',
    'accounts_department',
    'transportation',
    'research_development',
    'club_head',
    'iic',
    'store',
    'admission_incharge',
    'admission_counselor',
  ];

  for (const role of roles) {
    assert.match(dashboard, new RegExp(`\\b${role}:`), `${role} has no dashboard view`);
  }
});

test('dashboard role map resolves through one dedicated file per system role', () => {
  const dashboard = read('src/features/role-wise-features/dashboard/components/DashboardPage.tsx');
  const roleFiles = fs
    .readdirSync(
      path.join(root, 'src/features/role-wise-features/dashboard/components/role-dashboards'),
    )
    .filter((file) => file.endsWith('Dashboard.tsx'));

  assert.equal(roleFiles.length, 26);
  assert.match(dashboard, /role-dashboards\/StoreDashboard/);
  assert.match(dashboard, /admission_counselor: AdmissionCounselorDashboard/);
  assert.match(dashboard, /admission_incharge: AdmissionInchargeDashboard/);
  assert.match(dashboard, /iqac_team: IqacTeamDashboard/);
  assert.match(dashboard, /iqac_naac: IqacNaacDashboard/);
});

test('dashboard never prompts for location or fabricates weather without a configured service', () => {
  const dashboard = read('src/features/role-wise-features/dashboard/components/DashboardPage.tsx');

  assert.doesNotMatch(dashboard, /setTimeout\(requestLocation/);
  assert.doesNotMatch(dashboard, /navigator\.geolocation/);
  assert.doesNotMatch(dashboard, /Math\.random/);
});

test('dashboard UI does not ship reference metrics or manufactured calendar records', () => {
  const roleDirectory = path.join(
    root,
    'src/features/role-wise-features/dashboard/components/role-dashboards',
  );
  const roleSource = fs
    .readdirSync(roleDirectory)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => fs.readFileSync(path.join(roleDirectory, file), 'utf8'))
    .join('\n');

  assert.doesNotMatch(roleSource, /48,672|4,892|24\.65\s*L|92\.6%|28,542/);
  assert.doesNotMatch(roleSource, /Array\.from\(\{ length: 35 \}/);
  assert.doesNotMatch(
    roleSource,
    /className="space-y-3 bg-white(?:\s|")/,
    'a role dashboard must not paint a full white page over the shared canvas',
  );
});

test('principal dashboard renders its reference-aligned panels from matching API datasets', () => {
  const principal = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/PrincipalDashboard.tsx',
  );

  assert.match(principal, /d\.enrollmentTrend/);
  assert.match(principal, /d\.topPerformingStudents/);
  assert.match(principal, /d\.subjectPerformance/);
  assert.match(principal, /d\.totalClasses/);
  assert.match(principal, /item\.attendancePercentage/);
  assert.match(principal, /item\.passPercentage/);
  assert.doesNotMatch(principal, /const trend = \(d\.feesCollection/);
  assert.doesNotMatch(principal, /Number\(performance\.top \?\? 0\) \? '—' : '—'/);
});

test('admin renders institution data instead of the super-admin platform contract', () => {
  const admin = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/AdminDashboard.tsx',
  );

  assert.match(admin, /InstitutionCommandCenter/);
  assert.doesNotMatch(admin, /PlatformDashboard/);
});

test('HOD dashboard is a department-scoped command center with dedicated artwork', () => {
  const hod = read(
    'src/features/role-wise-features/dashboard/components/views/hod/HodOperationsDashboard.tsx',
  );
  const analytics = read(
    'src/features/role-wise-features/dashboard/components/views/hod/HodAnalyticsPanels.tsx',
  );

  assert.match(hod, /Department command centre/i);
  assert.match(hod, /\/hod-department-command-center\.png/);
  assert.match(hod, /data\.attentionSummary/);
  assert.match(analytics, /data\.operations/);
  assert.match(analytics, /data\.academicPerformance/);
  assert.match(analytics, /data\.sectionStrength/);
  assert.match(hod, /AcademicOutcomesPanel/);
  assert.match(hod, /CohortCompositionPanel/);
  assert.match(hod, /DailyOperationsPanel/);
  assert.match(hod, /HodAnalyticsPanels/);
  assert.doesNotMatch(`${hod}\n${analytics}`, /shadow(?:-|\b)/);
  assert.doesNotMatch(`${hod}\n${analytics}`, /Sparkles|Stars?/);
  assert.match(hod, /xl:grid-cols-12/);
});

test('tenant super admin renders institution data instead of SaaS platform analytics', () => {
  const superAdmin = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/SuperAdminDashboard.tsx',
  );
  const institution = read(
    'src/features/role-wise-features/dashboard/components/institution-admin/InstitutionCommandCenter.tsx',
  );

  assert.match(superAdmin, /InstitutionCommandCenter/);
  assert.match(institution, /Institution command center/i);
  assert.match(institution, /Recent admissions/);
  assert.match(institution, /Decisions requiring attention/);
  assert.match(institution, /d\.totalStudents/);
  assert.match(institution, /d\.recentAdmissions/);
  assert.match(institution, /d\.userBreakdown/);
  assert.match(institution, /router\.push\(path\(item\.link\)\)/);
  assert.doesNotMatch(superAdmin, /PlatformDashboard/);
  assert.doesNotMatch(
    `${superAdmin}\n${institution}`,
    /Total Organizations|Top Institutes|System Uptime/,
  );
});

test('academic dashboards do not derive grades or pass rates from unrelated metrics', () => {
  const faculty = read(
    'src/features/role-wise-features/dashboard/components/views/AcademicViews.tsx',
  );
  const hod = read(
    'src/features/role-wise-features/dashboard/components/views/hod/HodAnalyticsPanels.tsx',
  );
  const hodEntry = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/HodDashboard.tsx',
  );
  const dean = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/DeanAcademicDashboard.tsx',
  );

  assert.match(faculty, /d\.studentMarks/);
  assert.doesNotMatch(faculty, /averageCompletion \/ 10/);
  assert.match(hod, /data\.attendanceTrend/);
  assert.match(hod, /data\.sectionAttendance/);
  assert.match(hod, /data\.subjectProgress/);
  assert.match(hod, /data\.upcomingExams/);
  assert.doesNotMatch(hod, /completionPercentage \?\? 0\) \/ 10/);
  assert.match(hodEntry, /HodOperationsDashboard/);
  assert.match(dean, /d\.academicPerformance/);
  assert.doesNotMatch(dean, /const passAverage = attendance/);
  assert.doesNotMatch(dean, /`Department \$\{index \+ 1\}`|`Program \$\{index \+ 1\}`/);
});

test('student and parent headline metrics use exact attendance and CGPA fields', () => {
  const student = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/StudentDashboard.tsx',
  );
  const parent = read(
    'src/features/role-wise-features/dashboard/components/role-dashboards/ParentDashboard.tsx',
  );

  assert.match(student, /attendance\.donut\?\.percentage/);
  assert.match(student, /academic\?\.cgpa/);
  assert.doesNotMatch(student, /attendance\.donut\?\.present \?\? d\.attendancePercentage/);
  assert.match(parent, /attendedClasses \/ totalClasses/);
  assert.match(parent, /academic\?\.cgpa/);
  assert.doesNotMatch(parent, /gradeAverage \/ 10/);
});

test('tenant ERP does not ship platform health, organizations, or raw platform activity UI', () => {
  const dashboardSource = fs
    .readdirSync(path.join(root, 'src/features/role-wise-features/dashboard/components'), {
      recursive: true,
    })
    .filter((file) => String(file).endsWith('.tsx'))
    .map((file) =>
      fs.readFileSync(
        path.join(root, 'src/features/role-wise-features/dashboard/components', String(file)),
        'utf8',
      ),
    )
    .join('\n');

  assert.doesNotMatch(dashboardSource, /Top Institutes \(By Students\)/);
  assert.doesNotMatch(dashboardSource, /Total Organizations/);
  assert.doesNotMatch(dashboardSource, /Recent platform activities/);
});

test('role dashboard actions use real ERP module routes', () => {
  const specialist = read(
    'src/features/role-wise-features/dashboard/components/views/SpecialistViews.tsx',
  );
  const admin = read(
    'src/features/role-wise-features/dashboard/components/institution-admin/InstitutionCommandCenter.tsx',
  );

  assert.match(specialist, /path\('transport'\)/);
  assert.match(specialist, /path\('research-development'\)/);
  assert.match(specialist, /path\('iic'\)/);
  assert.match(specialist, /path\('store'\)/);
  assert.doesNotMatch(
    specialist,
    /path\('(routes|allocations|drivers|projects|publications|activities|inventory)'\)/,
  );
  assert.match(admin, /route: 'student-management'/);
  assert.match(admin, /router\.push\(path\(metric\.route\)\)/);
  assert.match(admin, /path\('admission'\)/);
  assert.doesNotMatch(admin, /router\.push\(`\/students/);
  assert.doesNotMatch(admin, /router\.push\(`\/admission\?review/);
});

test('meeting usage links to the canonical subscription workspace', () => {
  const usage = read(
    'src/features/role-wise-features/meeting/components/MeetingUsageDashboard.tsx',
  );

  assert.match(usage, /Manage capacity &amp; add-ons/);
  assert.match(usage, /settings\?tab=subscription/);
  assert.doesNotMatch(usage, /Generate add-on invoice/);
});
