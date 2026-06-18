import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const modelsDir = join(root, "dist", "models");
const exporter = new GLTFExporter();
const exec = promisify(execFile);
const fontPath = join(root, "node_modules/three/examples/fonts/ttf/kenpixel.ttf");
const fontJson = new TTFLoader().parse((await readFile(fontPath)).buffer);
const font = new FontLoader().parse(fontJson);

globalThis.FileReader ??= class {
  finish(result) {
    this.result = result;
    this.onloadend?.();
  }

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => this.finish(buffer), (error) => {
      this.error = error;
      this.onerror?.(error);
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const type = blob.type || "application/octet-stream";
      this.finish(`data:${type};base64,${Buffer.from(buffer).toString("base64")}`);
    }, (error) => {
      this.error = error;
      this.onerror?.(error);
    });
  }
};

const standard = (color, props = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...props });

const basic = (props) => new THREE.MeshBasicMaterial({ color: "white", ...props });

const mesh = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) => {
  const m = material instanceof THREE.Material || Array.isArray(material) ? material : standard(material);
  const result = new THREE.Mesh(geometry, m);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
};

const plane = (width, height, material, position, rotation = [-Math.PI / 2, 0, 0]) =>
  mesh(new THREE.PlaneGeometry(width, height), material, position, rotation);

const orientedTexturePlane = (width, height, material, position, rotation = [-Math.PI / 2, 0, 0]) => {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i += 1) {
    uv.setY(i, 1 - uv.getY(i));
  }
  uv.needsUpdate = true;
  return mesh(geometry, material, position, rotation);
};

const textGeometry = (text, size = 1) => {
  const geometry = new TextGeometry(text, {
    font,
    size,
    depth: 0.0001,
    curveSegments: 1,
    bevelEnabled: false,
  });
  geometry.computeBoundingBox();
  return geometry;
};

const textMesh = ({
  text,
  color = "black",
  fit = null,
  size = 1,
  position,
  rotation = [-Math.PI / 2, 0, 0],
}) => {
  const geometry = textGeometry(text, size);
  const { min, max } = geometry.boundingBox;
  geometry.translate(-(min.x + max.x) / 2, -(min.y + max.y) / 2, 0);
  if (fit) {
    const scale = Math.min(fit[0] / (max.x - min.x), fit[1] / (max.y - min.y));
    geometry.scale(scale, scale, scale);
  }
  return mesh(geometry, basic({ color, side: THREE.DoubleSide }), position, rotation);
};

const group = (...children) => {
  const result = new THREE.Group();
  result.add(...children);
  return result;
};

const card = ({ front, back, backSize = null, width = 0.063, height = 0.088, thickness = 0.0006 }) => {
  const frontLines = front.lines ?? [{ text: front.text, color: front.textColor, fit: front.fit, z: 0 }];
  return group(
    mesh(new THREE.BoxGeometry(width, thickness, height), "linen"),
    plane(width, height, basic({ color: front.color, side: THREE.FrontSide }), [0, thickness / 2 + 0.00002, 0]),
    ...frontLines.map((line) => textMesh({
      text: line.text,
      color: line.color ?? front.textColor ?? "black",
      fit: line.fit,
      position: [0, thickness / 2 + 0.00004, line.z],
    })),
    plane(width, height, basic({ color: back.color, side: THREE.FrontSide }), [0, -thickness / 2 - 0.00002, 0], [Math.PI / 2, 0, 0]),
    ...back.lines.map((line) => textMesh({
      text: line.text,
      color: line.color ?? back.textColor ?? "black",
      fit: backSize ? null : line.fit,
      size: backSize ?? 1,
      position: [0, -thickness / 2 - 0.00004, line.z],
      rotation: [Math.PI / 2, 0, 0],
    })),
  );
};

const resourceCard = ({ label, color, text }) => card({
  front: { text: "Resource", color: "oldlace", textColor: "black", fit: [0.045, 0.008] },
  back: {
    color,
    textColor: text,
    lines: [{ text: label, fit: [label.length > 4 ? 0.044 : 0.03, 0.008], z: 0 }],
  },
});

const actionCard = ({ title, lines }) => card({
  front: { text: "ACTION", color: "navy", textColor: "white", fit: [0.052, 0.01] },
  backSize: 0.0036,
  back: {
    color: "oldlace",
    textColor: "black",
    lines: [
      ...lines.map((text, index) => ({ text, z: 0.006 - index * 0.012 })),
      { text: title, z: 0.026 },
    ],
  },
});

const awardCard = ({ title, color }) => {
  const lines = [
    { text: "2 victory points", fit: [0.076, 0.011], z: 0.014 },
    { text: title, fit: [0.076, 0.013], z: -0.014 },
  ];
  return card({
    width: 0.088,
    height: 0.126,
    thickness: 0.002,
    front: { color, textColor: "black", lines },
    back: { color, textColor: "black", lines },
  });
};

const buildingCostTexture = async () => {
  const imageName = "building-cost-card.png";
  const htmlPath = join(modelsDir, "building-cost-card.html");
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    width: 880px;
    height: 1260px;
    overflow: hidden;
    background: transparent;
  }
  .card {
    width: 880px;
    height: 1260px;
    box-sizing: border-box;
    padding: 76px 70px;
    background: #fff3c7;
    color: #111;
    font-family: "Noto Sans Mono", "Noto Color Emoji", monospace;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  h1 {
    margin: 0 0 50px;
    font-size: 70px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0;
  }
  .cost {
    width: 100%;
    text-align: left;
  }
  .label {
    margin-top: 18px;
    font-size: 50px;
    font-weight: 700;
    line-height: 1;
  }
  .icons {
    margin: 12px 0 24px 42px;
    font-family: "Noto Color Emoji", "Noto Sans Mono", monospace;
    font-size: 66px;
    line-height: 1;
    white-space: nowrap;
  }
</style>
<div class="card">
  <h1>Building Costs</h1>
  <div class="cost">
    <div class="label">Road:</div>
    <div class="icons">🧱 🪵</div>
    <div class="label">Settlement:</div>
    <div class="icons">🧱 🪵 🐑 🌾</div>
    <div class="label">House:</div>
    <div class="icons">🌾 🌾 🪨 🪨 🪨</div>
    <div class="label">Action:</div>
    <div class="icons">🐑 🌾 🪨</div>
  </div>
</div>
`);
  await exec("chromium", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--screenshot=${imagePath}`,
    "--window-size=880,1260",
    pathToFileURL(htmlPath).href,
  ]);
  await rm(htmlPath, { force: true });
  return imageName;
};

const texturedCard = ({ imageUri }) => {
  const width = 0.088;
  const height = 0.126;
  const thickness = 0.002;
  const face = basic({ color: "white", side: THREE.DoubleSide });
  face.name = "Building cost card face";
  const result = group(
    mesh(new THREE.BoxGeometry(width, thickness, height), "linen"),
    orientedTexturePlane(width, height, face, [0, thickness / 2 + 0.00002, 0]),
    orientedTexturePlane(width, height, face, [0, -thickness / 2 - 0.00002, 0], [Math.PI / 2, 0, 0]),
  );
  result.userData.texturePatch = { materialName: face.name, imageUri };
  return result;
};

const tile = ({ label, color }) =>
  group(
    mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.002, 6), color),
    textMesh({ text: label, fit: [0.043, 0.01], position: [0, 0.00102, 0.021] }),
  );

const counter = (value) =>
  group(
    mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.002, 24), "linen"),
    textMesh({
      text: String(value),
      color: value === 6 || value === 8 ? "firebrick" : "black",
      fit: [value >= 10 ? 0.016 : 0.011, 0.009],
      position: [0, 0.00202, 0],
    }),
  );

const flatProfile = (points, depth) => {
  const shape = new THREE.Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, depth });
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  geometry.translate(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -(min.z + max.z) / 2);
  return geometry;
};

const roofFlatHalfLength = (halfLength, rise) =>
  (Math.sqrt(4 * halfLength ** 2 + 3 * rise ** 2) - halfLength) / 3;

const woodFace = standard("white", { roughness: 0.9, metalness: 0 });
const paintedWood = standard("white", { roughness: 0.86, metalness: 0 });
const woodMaterials = [woodFace, paintedWood];

const road = () => {
  const geometry = new THREE.BoxGeometry(0.025, 0.004, 0.004);
  return group(mesh(geometry, [woodFace, woodFace, paintedWood, paintedWood, paintedWood, paintedWood]));
};

const house = () => {
  const halfLength = 0.007;
  const roofRise = 0.005;
  const wallHeight = 0.007;
  const height = wallHeight + roofRise;
  return group(mesh(flatProfile([
    [-halfLength, 0],
    [-halfLength, wallHeight],
    [0, height],
    [halfLength, wallHeight],
    [halfLength, 0],
  ], 0.01), woodMaterials));
};

const settlement = () => {
  const bodyHalfLength = 0.0035;
  const roofRise = 0.0025;
  const wallHeight = 0.0145;
  const abutmentHeight = 0.008;
  const abutmentEnd = 0.0125;
  const height = wallHeight + roofRise;
  const roofHalfLength = roofFlatHalfLength(bodyHalfLength, roofRise);
  return group(mesh(flatProfile([
    [-bodyHalfLength, 0],
    [-bodyHalfLength, wallHeight],
    [-roofHalfLength, height],
    [roofHalfLength, height],
    [bodyHalfLength, wallHeight],
    [bodyHalfLength, abutmentHeight],
    [abutmentEnd, abutmentHeight],
    [abutmentEnd, 0],
  ], 0.01), woodMaterials));
};

const robber = () => {
  const plastic = new THREE.MeshPhysicalMaterial({
    color: "darkslateblue",
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
    metalness: 0,
    roughness: 0.72,
  });
  const result = group(
    mesh(new THREE.ConeGeometry(0.02, 0.055, 20), plastic, [0, 0.0275, 0]),
    mesh(new THREE.SphereGeometry(0.014, 16, 12), plastic, [0, 0.0503, 0]),
  );
  result.scale.setScalar(0.75);
  return result;
};

const dataUriToBuffer = (uri) => {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/u.exec(uri);
  return match ? Buffer.from(match[2], "base64") : null;
};

const exportGltf = async (name, object) => {
  const scene = new THREE.Scene();
  scene.name = name.replace(/\.gltf$/u, "");
  scene.add(object);

  const output = await exporter.parseAsync(scene, { binary: false });
  const baseName = name.replace(/\.gltf$/u, "");
  const texturePatch = object.userData.texturePatch;

  if (texturePatch) {
    const materialIndex = output.materials?.findIndex((material) => material.name === texturePatch.materialName);
    if (materialIndex === undefined || materialIndex < 0) {
      throw new Error(`Missing texture patch material ${texturePatch.materialName}`);
    }
    output.images ??= [];
    output.textures ??= [];
    output.samplers ??= [];
    const samplerIndex = output.samplers.push({
      magFilter: 9729,
      minFilter: 9729,
      wrapS: 33071,
      wrapT: 33071,
    }) - 1;
    const imageIndex = output.images.push({ uri: texturePatch.imageUri }) - 1;
    const textureIndex = output.textures.push({ sampler: samplerIndex, source: imageIndex }) - 1;
    output.materials[materialIndex].pbrMetallicRoughness ??= {};
    output.materials[materialIndex].pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
    output.materials[materialIndex].pbrMetallicRoughness.baseColorTexture = { index: textureIndex };
    output.materials[materialIndex].doubleSided = true;
    for (const node of output.nodes ?? []) {
      delete node.extras?.texturePatch;
      if (node.extras && Object.keys(node.extras).length === 0) delete node.extras;
    }
  }

  for (const [index, buffer] of (output.buffers ?? []).entries()) {
    if (!buffer.uri?.startsWith("data:")) continue;
    const bin = dataUriToBuffer(buffer.uri);
    const binName = output.buffers.length === 1 ? `${baseName}.bin` : `${baseName}-${index}.bin`;
    await writeFile(join(modelsDir, binName), bin);
    buffer.uri = binName;
    buffer.byteLength = bin.byteLength;
  }

  await writeFile(join(modelsDir, name), `${JSON.stringify(output, null, 2)}\n`);
};

const resources = {
  brick: { label: "BRICK", color: "peru", text: "saddlebrown" },
  grain: { label: "GRAIN", color: "gold", text: "darkgoldenrod" },
  lumber: { label: "LUMBER", color: "seagreen", text: "darkgreen" },
  ore: { label: "ORE", color: "slategray", text: "black" },
  wool: { label: "WOOL", color: "yellowgreen", text: "darkolivegreen" },
};

const assets = [
  ["ocean.gltf", () => group(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.002, 6), standard("steelblue", { roughness: 0.7, metalness: 0 })))],
  ...Object.entries(resources).map(([key, spec]) => [`resource-card-${key}.gltf`, () => resourceCard(spec)]),
  ["knight-card.gltf", () => actionCard({ title: "Knight", lines: ["Move robber", "Steal 1 card", "from neighbor"] })],
  ["road-building-card.gltf", () => actionCard({ title: "Road Building", lines: ["Place 2 roads", "for free"] })],
  ["year-of-plenty-card.gltf", () => actionCard({ title: "Year of Plenty", lines: ["Take any 2", "resource cards", "from pile"] })],
  ["monopoly-card.gltf", () => actionCard({ title: "Monopoly", lines: ["Name resource", "All players", "give you theirs"] })],
  ["victory-point-card.gltf", () => actionCard({ title: "Victory Point", lines: ["Keep hidden", "+1 point"] })],
  ["largest-army-card.gltf", () => awardCard({ title: "Largest Army", color: "lightpink" })],
  ["longest-road-card.gltf", () => awardCard({ title: "Longest Road", color: "paleturquoise" })],
  ["building-cost-card.gltf", () => texturedCard({ imageUri: "building-cost-card.png" })],
  ["tile-brick.gltf", () => tile(resources.brick)],
  ["tile-desert.gltf", () => tile({ label: "DESERT", color: "tan" })],
  ["tile-grain.gltf", () => tile(resources.grain)],
  ["tile-lumber.gltf", () => tile(resources.lumber)],
  ["tile-ore.gltf", () => tile(resources.ore)],
  ["tile-wool.gltf", () => tile(resources.wool)],
  ...[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((value) => [`counter-${value}.gltf`, () => counter(value)]),
  ["robber.gltf", robber],
  ["road.gltf", road],
  ["settlement.gltf", settlement],
  ["house.gltf", house],
];

await rm(modelsDir, { recursive: true, force: true });
await mkdir(modelsDir, { recursive: true });
await buildingCostTexture();
await Promise.all(assets.map(([name, build]) => exportGltf(name, build())));

console.log(`Generated ${assets.length} GLTF assets in dist/models/`);
