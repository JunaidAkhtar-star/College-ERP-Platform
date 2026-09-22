/** Matches exact origins and controlled `*.` subdomain rules from the CORS allowlist. */
export const isAllowedCorsOrigin = (origin: string, configuredOrigins: string): boolean => {
  const rules = configuredOrigins
    .split(",")
    .map((rule) => rule.trim())
    .filter(Boolean);

  return rules.some((rule) => {
    if (rule === origin) return true;
    if (!rule.includes("*.")) return false;

    try {
      const candidate = new URL(origin);
      const wildcardRule = new URL(rule.replace("*.", "tenant-placeholder."));
      const suffix = wildcardRule.hostname.replace(/^tenant-placeholder\./, "");
      const tenantLabel = candidate.hostname.slice(0, -(suffix.length + 1));

      return (
        candidate.protocol === wildcardRule.protocol &&
        candidate.port === wildcardRule.port &&
        candidate.hostname.endsWith(`.${suffix}`) &&
        tenantLabel.length > 0 &&
        !tenantLabel.includes(".")
      );
    } catch {
      return false;
    }
  });
};
