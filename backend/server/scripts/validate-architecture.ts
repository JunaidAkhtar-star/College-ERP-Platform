import { readdir } from "fs/promises";
import path from "path";
import { defineRouteModules, summarizeRouteDomains, validateDomainArchitecture } from "../platform";

async function main(): Promise<void> {
  const routeDirectory = path.join(__dirname, "../routes");
  const files = await readdir(routeDirectory);
  const routes = files
    .filter((filename) => /\.routes\.(ts|js)$/.test(filename))
    .map((filename) => filename.replace(/\.routes\.[^.]+$/, ""));

  const definitions = defineRouteModules(routes);
  validateDomainArchitecture(routes);
  const summary = summarizeRouteDomains(definitions);

  process.stdout.write(
    `Architecture valid: platform=${summary["platform-core"]}, ` +
      `shared=${summary["shared-foundation"]}, college-erp=${summary["product:college-erp"]}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Architecture validation failed: ${message}\n`);
  process.exitCode = 1;
});
