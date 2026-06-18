import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_URL } from "@probability-nz/types";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const packageJson = JSON.parse(await readFile(join(distDir, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(distDir, packageJson.main), "utf8"));

const fail = (message) => {
  throw new Error(`validate-manifest: ${message}`);
};

if (manifest.$schema !== SCHEMA_URL) {
  fail(`unexpected $schema ${JSON.stringify(manifest.$schema)}`);
}

if (packageJson.main !== "probability.json") {
  fail(`unexpected package main ${JSON.stringify(packageJson.main)}`);
}

if (!manifest.templates || typeof manifest.templates !== "object") {
  fail("templates must be an object");
}

if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length !== 1) {
  fail("expected exactly one scenario");
}

const templateNames = new Set(Object.keys(manifest.templates));
const assetPaths = new Set();
const tileTemplates = new Set([
  "tileBrick",
  "tileDesert",
  "tileCorn",
  "tileTimber",
  "tileOre",
  "tileWool",
  "harbor31",
  "harborBrick",
  "harborCorn",
  "harborTimber",
  "harborOre",
  "harborWool",
]);
const offBoardTemplates = new Set([
  "resourceCardBrick",
  "resourceCardCorn",
  "resourceCardTimber",
  "resourceCardOre",
  "resourceCardWool",
  "knightCard",
  "roadBuildingCard",
  "yearOfPlentyCard",
  "monopolyCard",
  "chapelCard",
  "greatHallCard",
  "libraryCard",
  "marketCard",
  "universityCard",
  "largestArmyCard",
  "longestRoadCard",
  "buildingCostCard",
  "businessCard",
  "road",
  "settlement",
  "house",
  "ruler",
]);

for (const [name, template] of Object.entries(manifest.templates)) {
  if (template.src === undefined) {
    fail(`template ${name} is missing src`);
  }
  assetPaths.add(template.src);
}

let pieceCount = 0;

const visit = (piece, path) => {
  pieceCount += 1;
  if (piece.template !== undefined && !templateNames.has(piece.template)) {
    fail(`${path} uses missing template ${piece.template}`);
  }
  if (piece.src !== undefined) {
    assetPaths.add(piece.src);
  }
  if (piece.tint !== undefined && piece.color !== undefined) {
    fail(`${path} uses both tint and deprecated color`);
  }
  piece.children?.forEach((child, index) => visit(child, `${path}.children[${index}]`));
};

manifest.scenarios[0].children.forEach((piece, index) => visit(piece, `scenarios[0].children[${index}]`));

const [ocean, ...offBoardPieces] = manifest.scenarios[0].children;
if (ocean?.template !== "ocean") {
  fail("scenario must start with one top-level ocean piece");
}
for (const [index, piece] of offBoardPieces.entries()) {
  if (!offBoardTemplates.has(piece.template)) {
    fail(`scenario root child ${index + 1} must be an off-board supply piece, got ${piece.template ?? "inline piece"}`);
  }
}
for (const [index, child] of (ocean.children ?? []).entries()) {
  if (!tileTemplates.has(child.template)) {
    fail(`ocean.children[${index}] must be a tile, got ${child.template ?? "inline piece"}`);
  }
}

for (const src of assetPaths) {
  if (/^[a-z]+:/iu.test(src) || src.startsWith("/")) {
    fail(`asset src must be a relative path: ${src}`);
  }
  const assetPath = join(distDir, src);
  await access(assetPath);

  if (src.endsWith(".gltf")) {
    const gltf = JSON.parse(await readFile(assetPath, "utf8"));
    for (const [index, buffer] of (gltf.buffers ?? []).entries()) {
      if (typeof buffer.uri !== "string" || buffer.uri.startsWith("data:")) {
        fail(`${src} buffer ${index} must use an external uri`);
      }
      await access(join(dirname(assetPath), buffer.uri));
    }
    for (const [index, image] of (gltf.images ?? []).entries()) {
      if (typeof image.uri !== "string" || image.uri.startsWith("data:")) {
        fail(`${src} image ${index} must use an external uri`);
      }
      await access(join(dirname(assetPath), image.uri));
    }
  }
}

console.log(`Manifest OK: ${pieceCount} pieces, ${assetPaths.size} assets`);
