const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const { Module, PermissionAction } = require("../build/constants/permissions");
const {
  permissionForRequest,
  permissionModulesForNavHref,
} = require("../build/constants/route-permissions");
const { mergeMissingDefaultPermissions } = require("../build/constants/role-defaults");
const { DEFAULT_PERMISSIONS } = require("../build/constants/role-defaults");
const { SystemRole } = require("../build/constants/roles");
const { API_MODULE_ENTITLEMENTS } = require("../build/constants/module-entitlements");
const { preferredDefaultRole } = require("../build/services/auth.service");

function request(route, method, path = "/") {
  return { baseUrl: `/api/v1/${route}`, method, path };
}

test("opens a teaching HOD account in its governance role by default", () => {
  assert.equal(preferredDefaultRole([SystemRole.FACULTY, SystemRole.HOD]), SystemRole.HOD);
  assert.equal(preferredDefaultRole([SystemRole.FACULTY]), SystemRole.FACULTY);
});

test("maps enterprise route families to authoritative permission modules", () => {
  assert.deepEqual(permissionForRequest(request("procurement", "GET", "/requisitions")), {
    module: Module.PROCUREMENT,
    action: PermissionAction.VIEW,
  });
  assert.deepEqual(permissionForRequest(request("communication-hub", "POST", "/campaigns")), {
    module: Module.COMMUNICATION_HUB,
    action: PermissionAction.CREATE,
  });
  assert.deepEqual(permissionForRequest(request("task", "PATCH", "/abc")), {
    module: Module.TASK_MANAGEMENT,
    action: PermissionAction.EDIT,
  });
});

test("derives approval and export actions before generic HTTP actions", () => {
  assert.deepEqual(permissionForRequest(request("procurement", "PATCH", "/abc/decide")), {
    module: Module.PROCUREMENT,
    action: PermissionAction.APPROVE,
  });
  assert.deepEqual(permissionForRequest(request("report-center", "GET", "/fees/export")), {
    module: Module.REPORT_CENTER,
    action: PermissionAction.EXPORT,
  });
  assert.deepEqual(permissionForRequest(request("advancement", "POST", "/designations")), {
    module: Module.ALUMNI,
    action: PermissionAction.APPROVE,
  });
  assert.deepEqual(permissionForRequest(request("iic", "POST", "/projects")), {
    module: Module.IIC,
    action: PermissionAction.VIEW,
  });
  assert.deepEqual(
    permissionForRequest(request("iic", "PATCH", "/projects/507f1f77bcf86cd799439011/transition")),
    { module: Module.IIC, action: PermissionAction.APPROVE },
  );
  assert.deepEqual(
    permissionForRequest(request("iic", "POST", "/projects/507f1f77bcf86cd799439011/milestones")),
    { module: Module.IIC, action: PermissionAction.EDIT },
  );
  assert.deepEqual(
    permissionForRequest(request("club", "POST", "/507f1f77bcf86cd799439011/join-request")),
    { module: Module.CLUBS, action: PermissionAction.VIEW },
  );
  assert.deepEqual(
    permissionForRequest(
      request("club", "PATCH", "/membership-requests/507f1f77bcf86cd799439011/decision"),
    ),
    { module: Module.CLUBS, action: PermissionAction.APPROVE },
  );
  assert.deepEqual(
    permissionForRequest(request("notice", "POST", "/507f1f77bcf86cd799439011/read")),
    { module: Module.NOTICE, action: PermissionAction.VIEW },
  );
});

test("maps Report Center workflows to semantic permissions", () => {
  const id = "507f1f77bcf86cd799439011";
  assert.deepEqual(permissionForRequest(request("report-center", "POST", "/preview")), {
    module: Module.REPORT_CENTER,
    action: PermissionAction.VIEW,
  });
  assert.deepEqual(permissionForRequest(request("report-center", "POST", `/${id}/submit`)), {
    module: Module.REPORT_CENTER,
    action: PermissionAction.EDIT,
  });
  assert.deepEqual(permissionForRequest(request("report-center", "POST", `/${id}/publish`)), {
    module: Module.REPORT_CENTER,
    action: PermissionAction.APPROVE,
  });
  assert.deepEqual(permissionForRequest(request("report-center", "POST", `/${id}/snapshot`)), {
    module: Module.REPORT_CENTER,
    action: PermissionAction.EXPORT,
  });
  assert.deepEqual(
    permissionForRequest(request("report-center", "PATCH", `/schedules/${id}/status`)),
    { module: Module.REPORT_CENTER, action: PermissionAction.EDIT },
  );
});

test("maps Import Center maker-checker workflows to semantic permissions", () => {
  const id = "507f1f77bcf86cd799439011";
  const expected = (action) => ({ module: Module.IMPORT_CENTER, action });

  assert.deepEqual(
    permissionForRequest(request("import-center", "GET", "/metadata")),
    expected(PermissionAction.VIEW),
  );
  assert.deepEqual(
    permissionForRequest(request("import-center", "POST", "/stage")),
    expected(PermissionAction.CREATE),
  );
  assert.deepEqual(
    permissionForRequest(request("import-center", "POST", `/${id}/cancel`)),
    expected(PermissionAction.EDIT),
  );
  assert.deepEqual(
    permissionForRequest(request("import-center", "POST", `/${id}/commit`)),
    expected(PermissionAction.APPROVE),
  );
  assert.deepEqual(
    permissionForRequest(request("import-center", "POST", `/${id}/rollback`)),
    expected(PermissionAction.DELETE),
  );
});

test("report author roles receive the actions exposed by their workspace", () => {
  for (const role of [
    SystemRole.DEAN_ACADEMIC,
    SystemRole.HOD,
    SystemRole.IQAC_TEAM,
    SystemRole.IQAC_NAAC,
  ]) {
    const permission = DEFAULT_PERMISSIONS[role].find(
      (entry) => entry.module === Module.REPORT_CENTER,
    );
    assert.ok(permission);
    for (const action of [
      PermissionAction.VIEW,
      PermissionAction.CREATE,
      PermissionAction.EDIT,
      PermissionAction.EXPORT,
    ]) {
      assert.ok(permission.actions.includes(action), `${role} lacks report_center:${action}`);
    }
  }
  const principal = DEFAULT_PERMISSIONS[SystemRole.PRINCIPAL].find(
    (entry) => entry.module === Module.REPORT_CENTER,
  );
  assert.ok(principal.actions.includes(PermissionAction.APPROVE));
});

test("denies custom-role inference for unmapped platform routes", () => {
  assert.equal(permissionForRequest(request("unknown-module", "POST")), null);
});

test("keeps personal navigation self-service separate from nav administration", () => {
  assert.equal(permissionForRequest(request("nav", "GET", "/me")), null);
  assert.deepEqual(permissionForRequest(request("nav", "GET", "/")), {
    module: Module.ROLE_MANAGEMENT,
    action: PermissionAction.VIEW,
  });
  assert.deepEqual(permissionForRequest(request("nav", "POST", "/")), {
    module: Module.ROLE_MANAGEMENT,
    action: PermissionAction.CREATE,
  });
});

test("keeps role-filtered bootstrap and personal endpoints self-service", () => {
  assert.equal(permissionForRequest(request("notification", "GET", "/my")), null);
  assert.equal(permissionForRequest(request("notification", "PUT", "/preferences")), null);
  assert.equal(permissionForRequest(request("admission", "GET", "/my-application")), null);
  assert.equal(permissionForRequest(request("academic-calendar", "GET", "/visible")), null);
  assert.deepEqual(permissionForRequest(request("academic-calendar", "GET", "/")), {
    module: Module.ACADEMIC_CALENDAR,
    action: PermissionAction.VIEW,
  });
  assert.equal(
    permissionForRequest(request("tenant-integrations", "GET", "/firebase/client-config")),
    null,
  );
  assert.deepEqual(permissionForRequest(request("tenant-integrations", "GET", "/")), {
    module: Module.EXTERNAL_CONNECTOR,
    action: PermissionAction.VIEW,
  });
});

test("maps navigation visibility to the same permission modules as APIs", () => {
  assert.deepEqual(permissionModulesForNavHref("/chat"), [Module.CHAT]);
  assert.deepEqual(permissionModulesForNavHref("/notification"), [Module.NOTIFICATION]);
  assert.deepEqual(permissionModulesForNavHref("/faculty-management"), [Module.FACULTY_MANAGEMENT]);
  assert.deepEqual(permissionModulesForNavHref("/admission/initiate"), [Module.ADMISSION]);
  assert.deepEqual(permissionModulesForNavHref("/campus-governance"), [Module.USER_MANAGEMENT]);
  assert.deepEqual(permissionModulesForNavHref("/facilities"), [Module.STORE]);
  assert.deepEqual(permissionModulesForNavHref("/advancement"), [Module.ALUMNI]);
  assert.deepEqual(permissionModulesForNavHref("/continuing-education"), [Module.CURRICULUM]);
  assert.deepEqual(permissionModulesForNavHref("/ai-governance"), [Module.COMPLIANCE]);
  assert.deepEqual(permissionModulesForNavHref("/government-integrations"), [
    Module.REGULATORY_INTEGRATION,
  ]);
});

test("every seeded business navigation page has an authoritative permission owner", () => {
  const seed = fs.readFileSync(path.join(__dirname, "../server/scripts/seed.ts"), "utf8");
  const hrefs = [...new Set([...seed.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]))];
  const authenticatedPersonalPages = new Set(["/profile", "/settings"]);
  const missing = hrefs.filter(
    (href) =>
      !authenticatedPersonalPages.has(href) && permissionModulesForNavHref(href).length === 0,
  );
  assert.deepEqual(missing, []);
});

test("every system role has the universal communication menu baseline", () => {
  for (const role of Object.values(SystemRole)) {
    const permissions = DEFAULT_PERMISSIONS[role];
    for (const module of [Module.NOTIFICATION, Module.NOTICE, Module.EVENT, Module.CHAT]) {
      assert.ok(
        permissions.some(
          (permission) =>
            permission.module === module && permission.actions.includes(PermissionAction.VIEW),
        ),
        `${role} is missing ${module}:view`,
      );
    }
  }
});

test("enterprise defaults keep monitoring, preparation and approval duties separated", () => {
  for (const module of [
    Module.EMPLOYEE,
    Module.FEE_MANAGEMENT,
    Module.TRANSPORT,
    Module.STORE,
    Module.PROCUREMENT,
    Module.FACULTY_MANAGEMENT,
  ]) {
    const permission = DEFAULT_PERMISSIONS[SystemRole.ADMINISTRATION_OFFICE].find(
      (entry) => entry.module === module,
    );
    assert.ok(permission?.actions.includes(PermissionAction.VIEW), `AO cannot view ${module}`);
    assert.ok(!permission?.actions.includes(PermissionAction.CREATE), `AO can create ${module}`);
    assert.ok(!permission?.actions.includes(PermissionAction.EDIT), `AO can edit ${module}`);
    assert.ok(!permission?.actions.includes(PermissionAction.APPROVE), `AO can approve ${module}`);
  }

  const aoAdmission = DEFAULT_PERMISSIONS[SystemRole.ADMINISTRATION_OFFICE].find(
    (permission) => permission.module === Module.ADMISSION,
  );
  for (const action of [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.APPROVE,
    PermissionAction.EXPORT,
  ]) {
    assert.ok(aoAdmission.actions.includes(action), `AO is missing admission:${action}`);
  }
  const aooAdmission = DEFAULT_PERMISSIONS[SystemRole.ASSISTANT_ADMINISTRATION_OFFICER].find(
    (permission) => permission.module === Module.ADMISSION,
  );
  assert.ok(aooAdmission.actions.includes(PermissionAction.APPROVE));

  const scholarshipCell = DEFAULT_PERMISSIONS[SystemRole.SCHOLARSHIP_CELL].find(
    (permission) => permission.module === Module.SCHOLARSHIP,
  );
  assert.ok(scholarshipCell.actions.includes(PermissionAction.EDIT));
  assert.ok(!scholarshipCell.actions.includes(PermissionAction.APPROVE));

  const iqacTeam = DEFAULT_PERMISSIONS[SystemRole.IQAC_TEAM].find(
    (permission) => permission.module === Module.IQAC,
  );
  const iqacApprover = DEFAULT_PERMISSIONS[SystemRole.IQAC_NAAC].find(
    (permission) => permission.module === Module.IQAC,
  );
  assert.ok(!iqacTeam.actions.includes(PermissionAction.APPROVE));
  assert.ok(iqacApprover.actions.includes(PermissionAction.APPROVE));

  const counselor = DEFAULT_PERMISSIONS[SystemRole.ADMISSION_COUNSELOR].find(
    (permission) => permission.module === Module.ADMISSION,
  );
  const incharge = DEFAULT_PERMISSIONS[SystemRole.ADMISSION_INCHARGE].find(
    (permission) => permission.module === Module.ADMISSION,
  );
  assert.ok(!counselor.actions.includes(PermissionAction.APPROVE));
  assert.ok(incharge.actions.includes(PermissionAction.APPROVE));
});

test("role migration appends new modules without overwriting tenant-edited actions", () => {
  const existing = [{ module: Module.PROCUREMENT, actions: [PermissionAction.VIEW] }];
  const defaults = [
    {
      module: Module.PROCUREMENT,
      actions: [PermissionAction.VIEW, PermissionAction.CREATE],
    },
    { module: Module.MEETING, actions: [PermissionAction.VIEW] },
  ];
  assert.deepEqual(mergeMissingDefaultPermissions(existing, defaults), [existing[0], defaults[1]]);
});

test("enterprise role migration is scoped, review-locked, backed up and reversible", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../server/scripts/migrate-enterprise-role-separation.ts"),
    "utf8",
  );
  assert.match(migration, /Writes require an explicit --tenant=<id\|database> or --all scope/);
  assert.match(migration, /approvedPlan !== hash/);
  assert.match(migration, /Policy drift detected/);
  assert.match(migration, /collection\("migrationbackups"\)\.insertOne/);
  assert.match(migration, /async function rollback\(runId: string\)/);
  assert.match(migration, /Available tenants:/);
  assert.match(migration, /Select one tenant number/);
  assert.match(migration, /const phrase = `APPLY \$\{tenantSelector\}`/);
  assert.match(migration, /Migration cancelled; no data was changed/);
});

test("every commercially entitled API family has an authoritative permission module", () => {
  const missing = Object.keys(API_MODULE_ENTITLEMENTS).filter(
    (route) => permissionForRequest(request(route, "GET")) === null,
  );
  assert.deepEqual(missing, []);
});
