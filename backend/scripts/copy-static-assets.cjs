/**
 * Copies runtime HTML assets that TypeScript does not emit into the build tree.
 * Keep this script dependency-free so production builds remain deterministic.
 */
const { cpSync, existsSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const assetDirectories = [
  ["server", "email", "templates"],
  ["server", "email", "layouts"],
  ["server", "pdf", "templates"],
];

for (const segments of assetDirectories) {
  const source = join(projectRoot, ...segments);
  const destination = join(projectRoot, "build", ...segments.slice(1));

  if (!existsSync(source)) {
    throw new Error(`Required runtime asset directory is missing: ${source}`);
  }

  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

console.info("Copied email and PDF templates into the production build.");
