interface IProductionEnvironment {
  NODE_ENV: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  AUDIT_HMAC_SECRET: string;
  REDIS_URL: string;
  RABBITMQ_URL: string;
  ENCRYPTION_KEY: string;
  ALLOWED_ORIGINS: string;
  FRONTEND_URL: string;
  TENANT_ROOT_DOMAIN: string;
  DASHBOARD_USERNAME: string;
  DASHBOARD_PASSWORD: string;
  CONNECTOR_EGRESS_HOSTS: string;
  CONNECTOR_WEBHOOK_BASE_URL: string;
}

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export function validateProductionEnvironment(env: IProductionEnvironment): string[] {
  if (env.NODE_ENV !== "production") return [];

  const errors: string[] = [];
  if (env.JWT_SECRET.length < 32) errors.push("JWT_SECRET must contain at least 32 characters");
  if (env.JWT_REFRESH_SECRET.length < 32) {
    errors.push("JWT_REFRESH_SECRET must contain at least 32 characters");
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push("JWT_SECRET and JWT_REFRESH_SECRET must be different");
  }
  if (env.AUDIT_HMAC_SECRET.length < 32) {
    errors.push("AUDIT_HMAC_SECRET must contain at least 32 characters");
  }
  if (
    env.AUDIT_HMAC_SECRET &&
    [env.JWT_SECRET, env.JWT_REFRESH_SECRET].includes(env.AUDIT_HMAC_SECRET)
  ) {
    errors.push("AUDIT_HMAC_SECRET must be independent from JWT secrets");
  }
  if (!env.REDIS_URL || !/^rediss?:\/\//i.test(env.REDIS_URL)) {
    errors.push("REDIS_URL must be configured with a redis:// or rediss:// URL");
  }
  if (!env.RABBITMQ_URL || !/^amqps?:\/\//i.test(env.RABBITMQ_URL)) {
    errors.push("RABBITMQ_URL must be configured with an amqp:// or amqps:// URL");
  }
  if (!/^[a-fA-F0-9]{64}$/.test(env.ENCRYPTION_KEY)) {
    errors.push("ENCRYPTION_KEY must be exactly 64 hexadecimal characters");
  }

  const origins = env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.some((origin) => !isHttpsUrl(origin))) {
    errors.push("ALLOWED_ORIGINS must contain only explicit HTTPS origins");
  }
  if (!isHttpsUrl(env.FRONTEND_URL)) errors.push("FRONTEND_URL must be an HTTPS URL");
  if (
    !env.CONNECTOR_EGRESS_HOSTS.split(",")
      .map((host) => host.trim())
      .filter(Boolean).length
  ) {
    errors.push("CONNECTOR_EGRESS_HOSTS must contain explicit approved provider hostnames");
  }
  if (!isHttpsUrl(env.CONNECTOR_WEBHOOK_BASE_URL)) {
    errors.push("CONNECTOR_WEBHOOK_BASE_URL must be an explicit HTTPS origin");
  }
  if (
    !env.TENANT_ROOT_DOMAIN ||
    env.TENANT_ROOT_DOMAIN === "localhost" ||
    env.TENANT_ROOT_DOMAIN.includes("://")
  ) {
    errors.push("TENANT_ROOT_DOMAIN must be a production hostname");
  }

  if (Boolean(env.DASHBOARD_USERNAME) !== Boolean(env.DASHBOARD_PASSWORD)) {
    errors.push("DASHBOARD_USERNAME and DASHBOARD_PASSWORD must be configured together");
  }
  return errors;
}
