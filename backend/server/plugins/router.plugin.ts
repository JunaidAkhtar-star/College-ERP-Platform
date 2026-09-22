import type { Express } from "express";
import { readdir } from "fs/promises";
import path from "path";
import { configs } from "../configs";
import { domainContext, errorHandler } from "../middlewares";
import {
  defineRouteModules,
  summarizeRouteDomains,
  validateDomainArchitecture,
  type BackendDomainId,
} from "../platform";
import { logger } from "../utils/logger.util";
import { SwaggerPlugin } from "./swagger.plugin";

export const RouterPlugin = {
  async setup(app: Express) {
    const routesDir = path.join(__dirname, "../routes");
    let files: string[];
    try {
      files = await readdir(routesDir);
    } catch (err) {
      logger.error("Failed to read routes directory", err);
      app.use(errorHandler);
      return;
    }

    const routeFiles = files.filter((filename) => /\.routes\.(ts|js)$/.test(filename));
    const definitions = defineRouteModules(
      routeFiles.map((filename) => filename.replace(/\.routes\.[^.]+$/, "")),
    );
    validateDomainArchitecture(definitions.map(({ route }) => route));
    const domainByRoute = new Map(definitions.map(({ route, domain }) => [route, domain]));

    // Load all routes in parallel, then mount in deterministic domain order.
    const imports = await Promise.all(
      routeFiles.map(async (filename) => {
        const route = filename.replace(/\.routes\.[^.]+$/, ""); // strip .routes.ts / .routes.js
        const mod = await import(path.join(routesDir, filename));
        return { route, domain: domainByRoute.get(route), router: mod.default };
      }),
    );

    imports.sort((left, right) => {
      const domainOrder = String(left.domain).localeCompare(String(right.domain));
      return domainOrder === 0 ? left.route.localeCompare(right.route) : domainOrder;
    });

    for (const { route, domain, router } of imports) {
      if (router) {
        app.use(
          `/${configs.API_VERSION}/${route}`,
          domainContext(domain as BackendDomainId),
          router,
        );
      }
    }
    const domainSummary = summarizeRouteDomains(definitions);
    logger.http(
      `Mounted ${imports.filter((i) => i.router).length} API modules under /${configs.API_VERSION}/ ` +
        `(platform=${domainSummary["platform-core"]}, shared=${domainSummary["shared-foundation"]}, ` +
        `college-erp=${domainSummary["product:college-erp"]}; see /api-docs)`,
    );

    // ── Swagger API Docs (/api-docs) ────────────────────────────────────────
    SwaggerPlugin.setup(app);

    // 404 + error handlers must come AFTER all routes
    app.use((_req, res) => {
      res.status(404).json({ success: false, error: { message: "Route not found" } });
    });
    app.use(errorHandler);
  },
};
