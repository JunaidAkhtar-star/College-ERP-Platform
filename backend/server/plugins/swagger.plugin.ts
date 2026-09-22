import type { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import listEndpoints from "express-list-endpoints";
import { configs } from "../configs";

// Cached spec — built once on first request, reused after that
let cachedSpec: object | null = null;

function buildOpenAPISpec(app: Express) {
  const endpoints = listEndpoints(app);
  const apiVersion = configs.API_VERSION; // e.g. "api/v1"
  const paths: Record<string, Record<string, object>> = {};

  for (const endpoint of endpoints) {
    // Only include API routes (skip /  /__stats  /api-docs etc.)
    if (!endpoint.path.startsWith(`/${apiVersion}/`)) continue;

    // Convert Express param syntax :id → OpenAPI syntax {id}
    const openApiPath = endpoint.path.replace(/:([^/]+)/g, "{$1}");

    if (!paths[openApiPath]) paths[openApiPath] = {};

    // Extract the tag from the first path segment after the version prefix
    const segments = endpoint.path.replace(`/${apiVersion}/`, "").split("/");
    const tag = segments[0]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    // Collect path parameters
    const paramMatches = [...endpoint.path.matchAll(/:([^/]+)/g)];
    const parameters = paramMatches.map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));

    for (const method of endpoint.methods) {
      if (method === "HEAD") continue;
      paths[openApiPath][method.toLowerCase()] = {
        tags: [tag],
        summary: `${method} ${endpoint.path}`,
        parameters,
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Success" },
          "400": { description: "Bad Request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Not Found" },
          "500": { description: "Internal Server Error" },
        },
      };
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Devvelocity ERP API",
      version: "1.0.0",
      description: "Auto-generated API documentation for the Devvelocity ERP backend",
    },
    servers: [
      {
        url: `http://${configs.HOST}:${configs.PORT}`,
        description: "Local Development",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    paths,
  };
}

export const SwaggerPlugin = {
  setup(app: Express) {
    // Disable entirely in production — avoids exposing API surface + saves CPU
    if (configs.NODE_ENV === "production") return;

    // Raw OpenAPI JSON spec — built once and cached
    app.get("/api-docs.json", (_req: Request, res: Response) => {
      if (!cachedSpec) cachedSpec = buildOpenAPISpec(app);
      res.json(cachedSpec);
    });

    // Swagger UI served at /api-docs
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(undefined, {
        swaggerOptions: { url: "/api-docs.json" },
        customSiteTitle: "Devvelocity ERP API Docs",
      }),
    );
  },
};
