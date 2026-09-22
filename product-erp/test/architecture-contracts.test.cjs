const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourceRoot = path.join(__dirname, '..', 'src');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const files = sourceFiles(sourceRoot);
const relative = (file) => path.relative(sourceRoot, file).split(path.sep).join('/');

test('feature code uses shared authenticated request utilities', () => {
  const allowedFetchFiles = new Set([
    'proxy.ts',
    'shared/hooks/useMutation.ts',
    'shared/hooks/useSwr.ts',
    'shared/utils/authenticatedRequest.ts',
    'shared/utils/pdfDownload.ts',
    'shared/utils/refreshSession.ts',
  ]);
  const violations = files
    .filter((file) => /\bfetch\s*\(/.test(fs.readFileSync(file, 'utf8')))
    .map(relative)
    .filter((file) => !allowedFetchFiles.has(file));

  assert.deepEqual(violations, []);
});

test('programmatic navigation uses the top-loader router', () => {
  const violations = files.flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return /import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*['"]next\/navigation['"]/.test(source)
      ? [relative(file)]
      : [];
  });

  assert.deepEqual(violations, []);
});

test('full viewport layouts use dynamic viewport height', () => {
  const violations = files
    .filter((file) => /(?:^|[\s"'`])h-screen(?:$|[\s"'`])/.test(fs.readFileSync(file, 'utf8')))
    .map(relative);

  assert.deepEqual(violations, []);
});

test('product surfaces do not use shadow utilities', () => {
  const violations = files
    .filter((file) => /(?:^|[\s"'`])(?:[a-z-]+:)*shadow(?:-|[\s"'`])/.test(fs.readFileSync(file, 'utf8')))
    .map(relative);

  assert.deepEqual(violations, []);
});

test('product surfaces do not use forbidden dark background utilities', () => {
  const violations = files
    .filter((file) =>
      /(?:^|[\s"'`])(?:[a-z-]+:)*bg-(?:black|slate-9\d\d|gray-9\d\d|zinc-9\d\d|neutral-9\d\d|stone-9\d\d)(?:\/\d+)?(?:$|[\s"'`])/.test(
        fs.readFileSync(file, 'utf8'),
      ),
    )
    .map(relative);

  assert.deepEqual(violations, []);
});

test('workspace and table bootstrap states use professional skeleton layouts', () => {
  const layout = fs.readFileSync(path.join(sourceRoot, 'shared/layouts/index.tsx'), 'utf8');
  const table = fs.readFileSync(path.join(sourceRoot, 'shared/core/CustomTable.tsx'), 'utf8');
  const skeleton = fs.readFileSync(path.join(sourceRoot, 'shared/core/WorkspaceSkeleton.tsx'), 'utf8');

  assert.match(layout, /WorkspaceSkeleton/);
  assert.doesNotMatch(layout, /h-8 w-8 animate-spin/);
  assert.match(table, /aria-label="Loading records"/);
  assert.match(table, /Array\.from\(\{ length: 5 \}/);
  assert.match(skeleton, /role="status"/);
  assert.match(skeleton, /sm:grid-cols-2 xl:grid-cols-4/);
});

test('session refresh survives reload races and role paths never become tenant IDs', () => {
  const refresh = fs.readFileSync(path.join(sourceRoot, 'shared/utils/refreshSession.ts'), 'utf8');
  const utilities = fs.readFileSync(path.join(sourceRoot, 'shared/utils/index.ts'), 'utf8');

  assert.match(refresh, /isUsableAccessToken/);
  assert.match(refresh, /res\.status === 429 \|\| res\.status >= 500/);
  assert.match(refresh, /tokenFromAnotherRequest/);
  assert.match(utilities, /'super_admin'/);
  assert.match(utilities, /'admin'/);
  assert.match(utilities, /'iqac_naac'/);
  assert.match(utilities, /'assistant_administration_officer'/);
  assert.match(utilities, /'hr_department'/);
});

test('shared role navigation preserves the active tenant path', () => {
  const utilities = fs.readFileSync(path.join(sourceRoot, 'shared/utils/index.ts'), 'utf8');
  const sharedNavigationFiles = [
    'shared/hooks/UseProtectedRoutes.tsx',
    'shared/layouts/index.tsx',
    'shared/layouts/Sidebar.tsx',
    'shared/layouts/Header.tsx',
    'shared/layouts/GlobalCalendarPanel.tsx',
    'shared/layouts/UserGuidePanel.tsx',
    'features/role-wise-features/dashboard/components/views/shared.tsx',
  ];

  assert.match(utilities, /export const getTenantRolePath/);
  assert.match(utilities, /getTenantId\(\)/);
  for (const file of sharedNavigationFiles) {
    const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
    assert.match(source, /getTenantRolePath/, `${file} must use the tenant-aware route builder`);
    assert.doesNotMatch(
      source,
      /(?:push|replace|prefetch)\(`\/\$\{role\}/,
      `${file} must not navigate to a role-only path`,
    );
  }
});

test('shared role hooks evaluate only the selected portal role', () => {
  const hooks = fs.readFileSync(path.join(sourceRoot, 'shared/hooks/useHasRole.ts'), 'utf8');

  assert.match(hooks, /activeRole\?\.baseRole/);
  assert.match(hooks, /activeRole\?\.name/);
  assert.match(hooks, /state\.role/);
  assert.doesNotMatch(hooks, /user\?\.roles/);
  assert.doesNotMatch(hooks, /userRoles/);
});

test('protected route parsing recognizes every current administrative role', () => {
  const source = fs.readFileSync(
    path.join(sourceRoot, 'shared/hooks/UseProtectedRoutes.tsx'),
    'utf8',
  );

  for (const role of [
    'super_admin',
    'admin',
    'iqac_naac',
    'iqac_team',
    'assistant_administration_officer',
  ]) {
    assert.match(source, new RegExp(`'${role}'`));
  }
});

test('explicit role allowlists cannot bypass tenant navigation and subscription policy', () => {
  const source = fs.readFileSync(
    path.join(sourceRoot, 'shared/hooks/UseProtectedRoutes.tsx'),
    'utf8',
  );

  assert.match(source, /Role allowlists and permission gates are\s+\/\/ additional constraints/);
  assert.doesNotMatch(source, /if \(!allowedRoles \|\| allowedRoles\.length === 0\) \{/);
  assert.match(source, /if \(!isPathInUserNav\(relPath, allowedNavHrefs\)\) return 'forbidden'/);
});

test('role workspaces never derive the current portal mode from all assigned roles', () => {
  for (const file of files.filter((candidate) =>
    relative(candidate).startsWith('features/role-wise-features/'),
  )) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /useAuthStore\(\(state\) => state\.user\?\.roles/,
      `${relative(file)} must use activeRole for current portal decisions`,
    );
    assert.doesNotMatch(
      source,
      /const activeRole = useAuthStore\(\(state\) => state\.role\)/,
      `${relative(file)} must resolve a custom role through its base role`,
    );
  }
});

test('business workflows hide storage URLs, raw JSON and browser prompts from users', () => {
  const studyMaterial = fs.readFileSync(
    path.join(
      sourceRoot,
      'features/role-wise-features/study-material/components/StudyMaterialPage.tsx',
    ),
    'utf8',
  );
  const procurement = fs.readFileSync(
    path.join(sourceRoot, 'features/role-wise-features/procurement/components/ProcurementPage.tsx'),
    'utf8',
  );
  const questions = fs.readFileSync(
    path.join(
      sourceRoot,
      'features/role-wise-features/question-bank/components/QuestionBankPage.tsx',
    ),
    'utf8',
  );
  const communication = fs.readFileSync(
    path.join(
      sourceRoot,
      'features/role-wise-features/communication-hub/components/CommunicationHubPage.tsx',
    ),
    'utf8',
  );

  assert.doesNotMatch(studyMaterial, /label[^\n]*File URL/i);
  assert.match(studyMaterial, /type="subjects"/);
  assert.match(studyMaterial, /type="sections"/);
  assert.match(studyMaterial, /InlineFileUpload/);
  assert.doesNotMatch(procurement, /HTTPS quote evidence URL/);
  assert.match(procurement, /Supplier quote document/);
  assert.doesNotMatch(questions, /Paste a JSON array/);
  assert.match(questions, /Download CSV template/);
  assert.doesNotMatch(communication, /window\.prompt/);
});

test('meeting add-on checkout has one canonical subscription workspace', () => {
  const dashboard = fs.readFileSync(
    path.join(
      sourceRoot,
      'features/role-wise-features/meeting/components/MeetingUsageDashboard.tsx',
    ),
    'utf8',
  );
  assert.match(dashboard, /settings\?tab=subscription/);
  assert.doesNotMatch(dashboard, /meeting\/addons\/catalog/);
  assert.doesNotMatch(dashboard, /meeting\/addons\/payment-proof/);
});

test('tenant pages do not render the removed global workspace guidance banner', () => {
  const layout = fs.readFileSync(path.join(sourceRoot, 'shared/layouts/index.tsx'), 'utf8');
  const removedBanner = path.join(sourceRoot, 'shared/layouts/RolePageContext.tsx');

  assert.equal(fs.existsSync(removedBanner), false);
  assert.doesNotMatch(layout, /RolePageContext/);
});

test('generated browser artifacts stay ignored and every public asset has a runtime reference', () => {
  const projectRoot = path.join(__dirname, '..');
  const ignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
  assert.match(ignore, /^\/test-results\/$/m);
  assert.match(ignore, /^\/playwright-report\/$/m);
  assert.match(ignore, /^\/blob-report\/$/m);

  const referenceRoots = [
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'e2e'),
  ];
  const referenceFiles = referenceRoots.flatMap((directory) => sourceFiles(directory));
  const referenceText = referenceFiles
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const publicRoot = path.join(projectRoot, 'public');
  const publicFiles = fs.readdirSync(publicRoot, { recursive: true, withFileTypes: true });
  const orphanedAssets = publicFiles
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => {
      const publicPath = `/${path.relative(publicRoot, file).split(path.sep).join('/')}`;
      return !referenceText.includes(publicPath) && !referenceText.includes(path.basename(file));
    })
    .map((file) => path.relative(projectRoot, file).split(path.sep).join('/'))
    .sort();

  assert.deepEqual(orphanedAssets, []);
});
