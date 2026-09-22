const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BackendDomain,
  defineRouteModules,
  domainEvents,
  resolveBackendDomain,
  summarizeRouteDomains,
  validateDomainArchitecture,
} = require("../build/platform");

test("platform, shared and ERP routes resolve to stable ownership", () => {
  assert.equal(resolveBackendDomain("super-admin"), BackendDomain.PLATFORM_CORE);
  assert.equal(resolveBackendDomain("auth"), BackendDomain.SHARED_FOUNDATION);
  assert.equal(resolveBackendDomain("attendance"), BackendDomain.COLLEGE_ERP);
});

test("route definitions are deterministic and reject duplicates", () => {
  const definitions = defineRouteModules(["attendance", "auth", "super-admin"]);
  assert.deepEqual(
    definitions.map(({ route, domain }) => [route, domain]),
    [
      ["super-admin", BackendDomain.PLATFORM_CORE],
      ["attendance", BackendDomain.COLLEGE_ERP],
      ["auth", BackendDomain.SHARED_FOUNDATION],
    ],
  );
  assert.throws(() => defineRouteModules(["auth", "auth"]), /Duplicate backend route modules/);
});

test("architecture validation fails when an explicitly owned route is missing", () => {
  assert.throws(() => validateDomainArchitecture(["auth"]), /declares missing route module/);
});

test("domain summaries always include every deployable domain", () => {
  const summary = summarizeRouteDomains(
    defineRouteModules(["super-admin", "auth", "attendance"]),
  );
  assert.deepEqual(summary, {
    [BackendDomain.PLATFORM_CORE]: 1,
    [BackendDomain.SHARED_FOUNDATION]: 1,
    [BackendDomain.COLLEGE_ERP]: 1,
  });
});

test("typed domain events publish an immutable ownership envelope", () => {
  let received;
  const unsubscribe = domainEvents.subscribe("tenant.lifecycle.changed", (event) => {
    received = event;
  });
  const published = domainEvents.publish(
    "tenant.lifecycle.changed",
    BackendDomain.PLATFORM_CORE,
    {
      tenantId: "tenant-a",
      productSlug: "college-erp",
      status: "active",
    },
    "request-123",
  );
  unsubscribe();

  assert.equal(received.id, published.id);
  assert.equal(received.source, BackendDomain.PLATFORM_CORE);
  assert.equal(received.correlationId, "request-123");
  assert.equal(received.payload.productSlug, "college-erp");
});

