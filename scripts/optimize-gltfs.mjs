import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const modelsDir = join(root, "dist", "models");
const GLTF_LINEAR_FILTER = 9729;
const GLTF_LINEAR_MIPMAP_LINEAR_FILTER = 9987;
const GLTF_REPEAT = 10497;
const moldedPlasticNormalAssets = new Set(["road.gltf", "house.gltf", "settlement.gltf"]);
const moldedPlasticMaterials = new Set(["Molded plastic end", "Molded plastic face", "Molded plastic side"]);

const applyMoldedPlasticNormal = (name, gltf) => {
  if (!moldedPlasticNormalAssets.has(name)) {
    return false;
  }

  const materials = gltf.materials ?? [];
  const materialIndexes = materials
    .map((material, index) => moldedPlasticMaterials.has(material.name) ? index : -1)
    .filter((index) => index >= 0);

  if (materialIndexes.length === 0) {
    return false;
  }

  gltf.images ??= [];
  gltf.textures ??= [];
  gltf.samplers ??= [];
  gltf.extensionsUsed ??= [];
  gltf.extensionsRequired ??= [];

  const samplerIndex = gltf.samplers.push({
    magFilter: GLTF_LINEAR_FILTER,
    minFilter: GLTF_LINEAR_MIPMAP_LINEAR_FILTER,
    wrapS: GLTF_REPEAT,
    wrapT: GLTF_REPEAT,
  }) - 1;
  const imageIndex = gltf.images.push({
    mimeType: "image/avif",
    uri: "molded-plastic-normal.avif",
  }) - 1;
  const textureIndex = gltf.textures.push({
    sampler: samplerIndex,
    extensions: {
      EXT_texture_avif: { source: imageIndex },
    },
  }) - 1;

  if (!gltf.extensionsUsed.includes("EXT_texture_avif")) {
    gltf.extensionsUsed.push("EXT_texture_avif");
  }
  if (!gltf.extensionsRequired.includes("EXT_texture_avif")) {
    gltf.extensionsRequired.push("EXT_texture_avif");
  }

  for (const materialIndex of materialIndexes) {
    materials[materialIndex].normalTexture = {
      index: textureIndex,
      scale: 0.9,
    };
  }

  return true;
};

const gltfNames = (await readdir(modelsDir)).filter((name) => name.endsWith(".gltf")).sort();

for (const name of gltfNames) {
  const file = join(modelsDir, name);
  const tempDir = await mkdtemp(join(tmpdir(), "settlers-gltf-"));
  try {
    const optimized = join(tempDir, name);
    await exec("gltf-transform", [
      "optimize",
      file,
      optimized,
      "--texture-compress",
      "false",
      "--compress",
      "meshopt",
      "--simplify",
      "false",
      "--palette",
      "false",
    ]);

    const gltf = JSON.parse(await readFile(optimized, "utf8"));
    applyMoldedPlasticNormal(name, gltf);
    for (const [index, buffer] of (gltf.buffers ?? []).entries()) {
      if (typeof buffer.uri !== "string") {
        continue;
      }
      const extension = extname(buffer.uri) || ".bin";
      const nextUri = `${basename(name, ".gltf")}-${index}${extension}`;
      await copyFile(join(tempDir, buffer.uri), join(modelsDir, nextUri));
      buffer.uri = nextUri;
    }
    await writeFile(file, `${JSON.stringify(gltf, null, 2)}\n`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const canonicalBins = new Map();
for (const name of gltfNames) {
  const file = join(modelsDir, name);
  const gltf = JSON.parse(await readFile(file, "utf8"));
  let changed = false;

  for (const buffer of gltf.buffers ?? []) {
    if (typeof buffer.uri !== "string") {
      continue;
    }

    const contents = await readFile(join(modelsDir, buffer.uri));
    const hash = createHash("sha256").update(contents).digest("hex");
    const key = `${hash}:${contents.byteLength}`;
    let canonicalUri = canonicalBins.get(key);
    if (canonicalUri === undefined) {
      canonicalUri = `buffer-${hash.slice(0, 16)}.bin`;
      canonicalBins.set(key, canonicalUri);
      await copyFile(join(modelsDir, buffer.uri), join(modelsDir, canonicalUri));
    }
    if (buffer.uri !== canonicalUri) {
      buffer.uri = canonicalUri;
      changed = true;
    }
  }

  if (changed) {
    await writeFile(file, `${JSON.stringify(gltf, null, 2)}\n`);
  }
}

const referencedBins = new Set();
for (const name of gltfNames) {
  const gltf = JSON.parse(await readFile(join(modelsDir, name), "utf8"));
  for (const buffer of gltf.buffers ?? []) {
    if (typeof buffer.uri === "string") {
      referencedBins.add(buffer.uri);
    }
  }
}

for (const name of await readdir(modelsDir)) {
  if (name.endsWith(".bin") && !referencedBins.has(name)) {
    await rm(join(modelsDir, name), { force: true });
  }
}

console.log(`Optimized ${gltfNames.length} GLTF assets`);
