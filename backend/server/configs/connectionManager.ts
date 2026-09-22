/**
 * @file connectionManager.ts
 * @description Manages tenant-specific database connections and intercepts Mongoose models
 *              using an ES6 Proxy. Facilitates physical database isolation per tenant
 *              via AsyncLocalStorage without modifying model references.
 * @module server/configs
 */

import mongoose, { type Connection, type Model, type Schema, type SchemaType } from "mongoose";
import { AsyncLocalStorage } from "async_hooks";

export interface ITenantStore {
  tenantId: string;
  tenantDb: Connection;
}

/**
 * AsyncLocalStorage container to store context for active web request.
 */
export const tenantLocalStorage = new AsyncLocalStorage<ITenantStore>();

const GLOBAL_MODELS = new Set([
  "Tenant",
  "Lead",
  "ProductModule",
  "PlatformProduct",
  "SubscriptionPlan",
  "ProductAddon",
  "PlatformBillingRecord",
  "PlatformBillingSettings",
  "PlatformCoupon",
  "PublicSiteConfig",
  "PlatformIntegration",
  "PublicCheckout",
  "CheckoutAgreement",
  "TenantPaymentAttempt",
  "TenantPaymentWebhookEvent",
  "SchedulerLease",
  "ImplementationProject",
  "SupportTicket",
  "PlacementNetworkListing",
  "PlacementNetworkRequest",
]);

type ReferencingSchemaType = SchemaType & {
  options?: { ref?: string };
  caster?: { options?: { ref?: string } };
  schema?: Schema;
};

// Models registered only to satisfy populate() lookups. Their cloned schemas
// explicitly disable collection/index creation until the model is used directly.
const dormantTenantModels = new WeakSet<Model<unknown>>();

function schemaReferences(schema: Schema): string[] {
  const references = new Set<string>();
  schema.eachPath((_path, rawType) => {
    const schemaType = rawType as ReferencingSchemaType;
    const directRef = schemaType.options?.ref;
    const arrayRef = schemaType.caster?.options?.ref;
    if (typeof directRef === "string") references.add(directRef);
    if (typeof arrayRef === "string") references.add(arrayRef);
    if (schemaType.schema) {
      for (const reference of schemaReferences(schemaType.schema)) references.add(reference);
    }
  });
  return [...references];
}

function registerDormantReference(tenantDb: Connection, modelName: string): void {
  if (GLOBAL_MODELS.has(modelName) || tenantDb.models[modelName]) return;
  if (!mongoose.modelNames().includes(modelName)) return;
  const defaultModel = originalModel(modelName);
  const dormantSchema = defaultModel.schema.clone();
  dormantSchema.set("autoCreate", false);
  dormantSchema.set("autoIndex", false);
  const dormantModel = tenantDb.model(modelName, dormantSchema);
  dormantTenantModels.add(dormantModel as Model<unknown>);
}

function activateTenantModel<T extends Model<unknown>>(tenantDb: Connection, defaultModel: T): T {
  const modelName = defaultModel.modelName;
  const registered = tenantDb.models[modelName] as Model<unknown> | undefined;
  if (registered && dormantTenantModels.has(registered)) {
    dormantTenantModels.delete(registered);
    tenantDb.deleteModel(modelName);
  }
  if (!tenantDb.models[modelName]) {
    tenantDb.model(modelName, defaultModel.schema);
    for (const reference of schemaReferences(defaultModel.schema)) {
      if (reference !== modelName) registerDormantReference(tenantDb, reference);
    }
  }
  return tenantDb.models[modelName] as unknown as T;
}

/**
 * Resolves the active model instance based on the tenant context.
 * Falls back to the default global model if no context is active.
 *
 * @param defaultModel - The base compiled mongoose model.
 * @returns The tenant-specific model if inside a tenant context.
 */
export function getTenantModel<T extends Model<unknown>>(defaultModel: T): T {
  const modelName = defaultModel.modelName;
  if (GLOBAL_MODELS.has(modelName)) {
    return defaultModel;
  }

  const store = tenantLocalStorage.getStore();
  if (!store || !store.tenantDb) {
    return defaultModel;
  }

  return activateTenantModel(store.tenantDb, defaultModel);
}

const proxyCache = new Map<string, unknown>();

/**
 * Wraps a model in an ES6 Proxy to intercept methods and resolve context-specific models dynamically.
 *
 * @param targetModel - The model instance compiled on the default connection.
 * @returns An ES6 Proxy wrapper.
 */
function createModelProxy<T extends Model<unknown>>(targetModel: T): T {
  const modelName = targetModel.modelName;
  if (proxyCache.has(modelName)) {
    return proxyCache.get(modelName) as T;
  }

  const proxy = new Proxy(targetModel, {
    get(target, prop, receiver) {
      const activeModel = getTenantModel(target);
      const value = Reflect.get(activeModel, prop, receiver);
      if (typeof value === "function") {
        return value.bind(activeModel);
      }
      return value;
    },
    construct(target, argumentsList) {
      const activeModel = getTenantModel(target);
      return Reflect.construct(activeModel, argumentsList);
    },
    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(getTenantModel(target));
    },
  }) as unknown as T;

  proxyCache.set(modelName, proxy);
  return proxy;
}

const originalModel = mongoose.model.bind(mongoose);
type MongooseModelFn = typeof mongoose.model;

/**
 * Intercepts calls to mongoose.model globally so new registrations automatically use proxies.
 */
export function patchMongooseModel(): void {
  const patchedModel = function <T>(
    name: string,
    schema?: Schema<T>,
    collection?: string,
  ): Model<T> {
    const model = originalModel(name, schema, collection);
    return createModelProxy(model as unknown as Model<unknown>) as unknown as Model<T>;
  } as unknown as MongooseModelFn;

  mongoose.model = patchedModel;
}

/**
 * Pre-registers all existing default models onto the tenant connection.
 *
 * @param tenantDb - The connection specific to the tenant.
 */
const tenantConnectionMap = new Map<string, Connection>();

/**
 * Resolves a cached connection for a given tenant identifier.
 *
 * @param tenantId - Unique identifier of the tenant.
 * @returns Mongoose connection instance linked to the tenant's database.
 */
export const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,49}$/;

export function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim().toLowerCase();
  if (!TENANT_ID_PATTERN.test(normalized)) {
    throw new Error(
      "Tenant ID must be 3-50 lowercase letters, numbers, underscores, or hyphens and start with a letter or number.",
    );
  }
  return normalized;
}

export function tenantDatabaseName(tenantId: string): string {
  return `tenant_${normalizeTenantId(tenantId)}`;
}

export async function waitForActiveConnection(timeoutMs = 10000): Promise<void> {
  if ((mongoose.connection.readyState as number) === 1) return;
  const start = Date.now();
  while ((mongoose.connection.readyState as number) !== 1) {
    if (Date.now() - start > timeoutMs) {
      // Check one last time before throwing
      if ((mongoose.connection.readyState as number) === 1) return;
      throw new Error("Main database connection is not active.");
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export function getTenantConnection(tenantId: string, configuredDatabaseName?: string): Connection {
  const dbName = tenantDatabaseName(tenantId);
  if (configuredDatabaseName && configuredDatabaseName !== dbName) {
    throw new Error(`Tenant database mapping is invalid for '${normalizeTenantId(tenantId)}'.`);
  }

  const cachedConnection = tenantConnectionMap.get(dbName);
  if (cachedConnection && (mongoose.connection.readyState as number) === 1) {
    return cachedConnection;
  }

  if ((mongoose.connection.readyState as number) !== 1) {
    // If a cached connection exists from before disconnect, return it so operations can buffer in Mongoose driver
    if (cachedConnection) return cachedConnection;
    throw new Error("Main database connection is not active.");
  }

  const tenantConnection = mongoose.connection.useDb(dbName, { useCache: true });

  tenantConnectionMap.set(dbName, tenantConnection);
  return tenantConnection;
}

/**
 * Permanently removes an isolated tenant database and evicts its cached connection.
 * The derived database name is always validated to prevent deletion of an arbitrary database.
 */
export async function dropTenantDatabase(
  tenantId: string,
  configuredDatabaseName: string,
): Promise<void> {
  const dbName = tenantDatabaseName(tenantId);
  if (configuredDatabaseName !== dbName) {
    throw new Error(`Tenant database mapping is invalid for '${normalizeTenantId(tenantId)}'.`);
  }

  const tenantConnection = getTenantConnection(tenantId, configuredDatabaseName);
  await tenantConnection.dropDatabase();
  tenantConnectionMap.delete(dbName);
}
