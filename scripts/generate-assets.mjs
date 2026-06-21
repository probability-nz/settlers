import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const modelsDir = join(root, "dist", "models");
const exporter = new GLTFExporter();
const exec = promisify(execFile);
const monoTextRegularFontUrl = pathToFileURL(join(root, "AtkinsonHyperlegibleMono-Regular.ttf")).href;
const monoTextBoldFontUrl = pathToFileURL(join(root, "AtkinsonHyperlegibleMono-Bold.ttf")).href;
const monoEmojiFontUrl = pathToFileURL(join(root, "OpenMoji-black-glyf.ttf")).href;
const monoTextFontStack = `"Atkinson Hyperlegible Mono", monospace`;
const monoTextEmojiFontStack = `"Atkinson Hyperlegible Mono", "SettlersMonoEmoji", monospace`;
const monoEmojiTextFontStack = `"SettlersMonoEmoji", "Atkinson Hyperlegible Mono", monospace`;
const monoFontCss = `@font-face {
    font-family: "Atkinson Hyperlegible Mono";
    src: url("${monoTextRegularFontUrl}") format("truetype");
    font-style: normal;
    font-weight: 400;
  }
  @font-face {
    font-family: "Atkinson Hyperlegible Mono";
    src: url("${monoTextBoldFontUrl}") format("truetype");
    font-style: normal;
    font-weight: 700;
  }
  @font-face {
    font-family: "SettlersMonoEmoji";
    src: url("${monoEmojiFontUrl}") format("truetype");
  }`;
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

// shared light edge color: pieces read as paper, so cut edges show the same
// pale stock on cards, tiles, and the business card rather than a printed face
const paperEdgeColor = "linen";
const GLTF_LINEAR_FILTER = 9729;
const GLTF_LINEAR_MIPMAP_LINEAR_FILTER = 9987;
const GLTF_CLAMP_TO_EDGE = 33071;
const GLTF_REPEAT = 10497;
const AVIF_QUALITY = "60";

const avifName = (name) => name.replace(/\.png$/u, ".avif");

const captureTexture = async ({ htmlPath, imagePath, windowSize }) => {
  const finalImagePath = avifName(imagePath);
  const pngPath = `${finalImagePath}.png`;
  await exec("chromium", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--screenshot=${pngPath}`,
    `--window-size=${windowSize}`,
    pathToFileURL(htmlPath).href,
  ]);
  await exec("magick", [
    pngPath,
    "-quality",
    AVIF_QUALITY,
    finalImagePath,
  ]);
  await rm(htmlPath, { force: true });
  await rm(pngPath, { force: true });
};

const mesh = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) => {
  const m = material instanceof THREE.Material || Array.isArray(material) ? material : standard(material);
  const result = new THREE.Mesh(geometry, m);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
};

const flattenedEdgeNormal = ({ outward, v, normalTilt }) => {
  const centered = v * 2 - 1;
  const shaped = Math.sign(centered) * Math.max(0, Math.abs(centered) - 0.38) / 0.62;
  const eased = shaped * shaped * (3 - 2 * Math.abs(shaped));
  const up = -Math.sin(normalTilt) * eased;
  const out = Math.sqrt(Math.max(0, 1 - up * up));
  return [outward[0] * out, up, outward[1] * out];
};

const cardGeometry = (width, height, thickness) => {
  const x = width / 2;
  const y = thickness / 2;
  const z = height / 2;
  const normalTilt = THREE.MathUtils.degToRad(5);
  const edgeSegments = 8;
  const edgeDepthSegments = 6;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const addFace = ({
    corners,
    normal,
    faceNormals,
    materialIndex,
    faceUvs = [[0, 0], [1, 0], [1, 1], [0, 1]],
  }) => {
    const start = indices.length;
    const offset = positions.length / 3;
    for (const [index, corner] of corners.entries()) {
      positions.push(...corner);
      normals.push(...(faceNormals?.[index] ?? normal));
      uvs.push(...faceUvs[index]);
    }
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    geometry.addGroup(start, 6, materialIndex);
  };

  const addCurvedEdge = ({ bottomStart, topStart, topEnd, bottomEnd, outward, repeat }) => {
    const lerp = (a, b, t) => a.map((value, axis) => value + (b[axis] - value) * t);
    for (let lengthIndex = 0; lengthIndex < edgeSegments; lengthIndex += 1) {
      const t0 = lengthIndex / edgeSegments;
      const t1 = (lengthIndex + 1) / edgeSegments;
      for (let depthIndex = 0; depthIndex < edgeDepthSegments; depthIndex += 1) {
        const v0 = depthIndex / edgeDepthSegments;
        const v1 = (depthIndex + 1) / edgeDepthSegments;
        const bottom0 = lerp(bottomStart, bottomEnd, t0);
        const top0 = lerp(topStart, topEnd, t0);
        const bottom1 = lerp(bottomStart, bottomEnd, t1);
        const top1 = lerp(topStart, topEnd, t1);
        addFace({
          corners: [
            lerp(bottom0, top0, v0),
            lerp(bottom0, top0, v1),
            lerp(bottom1, top1, v1),
            lerp(bottom1, top1, v0),
          ],
          faceNormals: [
            flattenedEdgeNormal({ outward, v: v0, normalTilt }),
            flattenedEdgeNormal({ outward, v: v1, normalTilt }),
            flattenedEdgeNormal({ outward, v: v1, normalTilt }),
            flattenedEdgeNormal({ outward, v: v0, normalTilt }),
          ],
          materialIndex: 0,
          faceUvs: [
            [repeat * t0, v0],
            [repeat * t0, v1],
            [repeat * t1, v1],
            [repeat * t1, v0],
          ],
        });
      }
    }
  };

  const geometry = new THREE.BufferGeometry();
  const frontUvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const backUvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
  addFace({
    corners: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]],
    normal: [0, 1, 0],
    materialIndex: 1,
    faceUvs: frontUvs,
  });
  addFace({
    corners: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]],
    normal: [0, -1, 0],
    materialIndex: 2,
    faceUvs: backUvs,
  });
  addCurvedEdge({
    bottomStart: [x, -y, -z],
    topStart: [x, y, -z],
    topEnd: [x, y, z],
    bottomEnd: [x, -y, z],
    outward: [1, 0],
    repeat: height / thickness,
  });
  addCurvedEdge({
    bottomStart: [-x, -y, z],
    topStart: [-x, y, z],
    topEnd: [-x, y, -z],
    bottomEnd: [-x, -y, -z],
    outward: [-1, 0],
    repeat: height / thickness,
  });
  addCurvedEdge({
    bottomStart: [-x, -y, z],
    topStart: [-x, y, z],
    topEnd: [x, y, z],
    bottomEnd: [x, -y, z],
    outward: [0, 1],
    repeat: width / thickness,
  });
  addCurvedEdge({
    bottomStart: [x, -y, -z],
    topStart: [x, y, -z],
    topEnd: [-x, y, -z],
    bottomEnd: [-x, -y, -z],
    outward: [0, -1],
    repeat: width / thickness,
  });

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};

const hexTileGeometry = ({ radius, thickness }) => {
  const y = thickness / 2;
  const normalTilt = THREE.MathUtils.degToRad(5);
  const sides = 6;
  const edgeDepthSegments = 6;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();

  const addVertex = ({ position, normal, uv }) => {
    positions.push(...position);
    normals.push(...normal);
    uvs.push(...uv);
    return positions.length / 3 - 1;
  };

  const addTri = (a, b, c, materialIndex) => {
    const start = indices.length;
    indices.push(a, b, c);
    geometry.addGroup(start, 3, materialIndex);
  };

  const addQuad = (corners, faceNormals, faceUvs, materialIndex) => {
    const start = indices.length;
    const offset = positions.length / 3;
    for (const [index, corner] of corners.entries()) {
      positions.push(...corner);
      normals.push(...faceNormals[index]);
      uvs.push(...faceUvs[index]);
    }
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    geometry.addGroup(start, 6, materialIndex);
  };

  const uvFor = ([x, , z]) => [0.5 + x / (radius * 2), 0.5 + z / (radius * 2)];
  const ring = Array.from({ length: sides }, (_, index) => {
    const angle = Math.PI / 6 + (index / sides) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });

  const topCenter = addVertex({ position: [0, y, 0], normal: [0, 1, 0], uv: [0.5, 0.5] });
  const bottomCenter = addVertex({ position: [0, -y, 0], normal: [0, -1, 0], uv: [0.5, 0.5] });
  const top = ring.map(([x, z]) => addVertex({ position: [x, y, z], normal: [0, 1, 0], uv: uvFor([x, y, z]) }));
  const bottom = ring.map(([x, z]) => addVertex({ position: [x, -y, z], normal: [0, -1, 0], uv: uvFor([x, -y, z]) }));

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    addTri(topCenter, top[next], top[index], 1);
    addTri(bottomCenter, bottom[index], bottom[next], 2);
  }

  for (let sideIndex = 0; sideIndex < sides; sideIndex += 1) {
    const next = (sideIndex + 1) % sides;
    const bottomStart = [ring[sideIndex][0], -y, ring[sideIndex][1]];
    const topStart = [ring[sideIndex][0], y, ring[sideIndex][1]];
    const topEnd = [ring[next][0], y, ring[next][1]];
    const bottomEnd = [ring[next][0], -y, ring[next][1]];
    const midX = (ring[sideIndex][0] + ring[next][0]) / 2;
    const midZ = (ring[sideIndex][1] + ring[next][1]) / 2;
    const length = Math.hypot(midX, midZ);
    const outward = [midX / length, midZ / length];
    const lerp = (a, b, t) => a.map((value, axis) => value + (b[axis] - value) * t);

    for (let depthIndex = 0; depthIndex < edgeDepthSegments; depthIndex += 1) {
      const v0 = depthIndex / edgeDepthSegments;
      const v1 = (depthIndex + 1) / edgeDepthSegments;
      addQuad([
        lerp(bottomStart, topStart, v0),
        lerp(bottomStart, topStart, v1),
        lerp(bottomEnd, topEnd, v1),
        lerp(bottomEnd, topEnd, v0),
      ], [
        flattenedEdgeNormal({ outward, v: v0, normalTilt }),
        flattenedEdgeNormal({ outward, v: v1, normalTilt }),
        flattenedEdgeNormal({ outward, v: v1, normalTilt }),
        flattenedEdgeNormal({ outward, v: v0, normalTilt }),
      ], [
        [sideIndex, v0],
        [sideIndex, v1],
        [sideIndex + 1, v1],
        [sideIndex + 1, v0],
      ], 0);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};

const coinGeometry = ({ radius, thickness, segments = 20 }) => {
  const y = thickness / 2;
  const normalTilt = THREE.MathUtils.degToRad(5);
  const edgeDepthSegments = 6;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();

  const addVertex = ({ position, normal, uv }) => {
    positions.push(...position);
    normals.push(...normal);
    uvs.push(...uv);
    return positions.length / 3 - 1;
  };

  const topCenter = addVertex({ position: [0, y, 0], normal: [0, 1, 0], uv: [0.5, 0.5] });
  const bottomCenter = addVertex({ position: [0, -y, 0], normal: [0, -1, 0], uv: [0.5, 0.5] });
  const top = [];
  const bottom = [];
  const side = Array.from({ length: edgeDepthSegments + 1 }, () => []);

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const u = 0.5 + Math.cos(angle) * 0.5;
    const v = 0.5 + Math.sin(angle) * 0.5;
    const outward = [Math.cos(angle), Math.sin(angle)];
    top.push(addVertex({ position: [x, y, z], normal: [0, 1, 0], uv: [u, v] }));
    bottom.push(addVertex({ position: [x, -y, z], normal: [0, -1, 0], uv: [u, v] }));
    for (let depthIndex = 0; depthIndex <= edgeDepthSegments; depthIndex += 1) {
      const depth = depthIndex / edgeDepthSegments;
      side[depthIndex].push(addVertex({
        position: [x, -y + thickness * depth, z],
        normal: flattenedEdgeNormal({ outward, v: depth, normalTilt }),
        uv: [index / segments, depth],
      }));
    }
  }

  geometry.addGroup(0, segments * 3, 1);
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(topCenter, top[next], top[index]);
  }

  geometry.addGroup(indices.length, segments * 3 + segments * edgeDepthSegments * 6, 0);
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(bottomCenter, bottom[index], bottom[next]);
    for (let depthIndex = 0; depthIndex < edgeDepthSegments; depthIndex += 1) {
      indices.push(side[depthIndex][index], side[depthIndex + 1][next], side[depthIndex][next]);
      indices.push(side[depthIndex][index], side[depthIndex + 1][index], side[depthIndex + 1][next]);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};

const cuttingMatGeometry = ({ width, height, thickness, grid = 0.01 }) => {
  const positions = [];
  const indices = [];
  const addRect = ({ x, z, width, depth, y }) => {
    const left = x - width / 2;
    const right = x + width / 2;
    const top = z - depth / 2;
    const bottom = z + depth / 2;
    const offset = positions.length / 3;
    positions.push(
      left, y, top,
      right, y, top,
      right, y, bottom,
      left, y, bottom,
    );
    indices.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2);
  };

  const y = thickness / 2 + 0.00012;
  const lineWidth = 0.00035;
  const majorLineWidth = 0.0009;
  const cellsX = 81;
  const cellsZ = 56;
  const gridWidth = cellsX * grid;
  const gridHeight = cellsZ * grid;
  const edgeOverlap = lineWidth;

  for (let index = 0; index <= cellsX; index += 1) {
    const width = index > 0 && index % 10 === 0 ? majorLineWidth : lineWidth;
    addRect({ x: -gridWidth / 2 + index * grid, z: 0, width, depth: gridHeight + edgeOverlap, y });
  }
  for (let index = 0; index <= cellsZ; index += 1) {
    const depth = index > 0 && index % 10 === 0 ? majorLineWidth : lineWidth;
    addRect({ x: 0, z: -gridHeight / 2 + index * grid, width: gridWidth + edgeOverlap, depth, y });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const cuttingMat = ({ width = 0.841, height = 0.594, thickness = 0.002 } = {}) => {
  const base = standard(oceanColor, { roughness: 0.7, metalness: 0 });
  const grid = basic({ color: "#bed3e5" });
  base.side = THREE.DoubleSide;
  grid.side = THREE.DoubleSide;
  const baseMesh = mesh(cardGeometry(width, height, thickness), [base, base, base]);
  const gridMesh = mesh(cuttingMatGeometry({ width, height, thickness }), grid);
  baseMesh.castShadow = false;
  baseMesh.receiveShadow = false;
  gridMesh.castShadow = false;
  gridMesh.receiveShadow = false;
  return group(baseMesh, gridMesh);
};

const correctHexTextureUVs = (geometry) => {
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i += 1) {
    const x = uv.getX(i) - 0.5;
    const y = uv.getY(i) - 0.5;
    uv.setXY(i, 0.5 + y, 0.5 + x);
  }
  uv.needsUpdate = true;
  return geometry;
};

const group = (...children) => {
  const result = new THREE.Group();
  result.add(...children);
  return result;
};

const resourceCard = (key) => texturedCard({
  frontImageUri: "resource-card-front.png",
  backImageUri: `resource-card-${key}.png`,
  width: 0.063,
  height: 0.088,
  thickness: 0.0006,
  materialName: `Resource card ${key} face`,
});

const actionCard = (key) => texturedCard({
  frontImageUri: "development-card-front.png",
  backImageUri: `${key}-card-back.png`,
  width: 0.063,
  height: 0.088,
  thickness: 0.0006,
  materialName: `Development card ${key} face`,
});

const awardCard = (key) => texturedCard({
  imageUri: `${key}-card.png`,
  width: 0.088,
  height: 0.126,
  thickness: 0.002,
  materialName: `Award card ${key} face`,
});

const resourceCardFrontTexture = async () => {
  const imageName = "resource-card-front.png";
  const htmlPath = join(modelsDir, "resource-card-front.html");
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 630px;
    height: 880px;
    overflow: hidden;
    background: transparent;
  }
  .card {
    width: 630px;
    height: 880px;
    box-sizing: border-box;
    background: oldlace;
    color: black;
    font-family: ${monoTextEmojiFontStack};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 78px;
    font-weight: 700;
  }
</style>
<div class="card">RESOURCE</div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "630,880" });
  return imageName;
};

const resourceCardBackTexture = async (key, { label, color, emoji }) => {
  const imageName = `resource-card-${key}.png`;
  const htmlPath = join(modelsDir, `resource-card-${key}.html`);
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 630px;
    height: 880px;
    overflow: hidden;
    background: transparent;
  }
  .card {
    width: 630px;
    height: 880px;
    box-sizing: border-box;
    background: ${color};
    color: black;
    font-family: ${monoTextEmojiFontStack};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .label {
    font-size: 82px;
    font-weight: 700;
    line-height: 1;
  }
  .emoji {
    margin-top: 96px;
    font-family: ${monoEmojiTextFontStack};
    font-size: 150px;
    line-height: 1;
  }
</style>
<div class="card"><div class="label">${label}</div><div class="emoji">${emoji}</div></div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "630,880" });
  return imageName;
};

const developmentCardFrontTexture = async () => {
  const imageName = "development-card-front.png";
  const htmlPath = join(modelsDir, "development-card-front.html");
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 630px;
    height: 880px;
    overflow: hidden;
    background: transparent;
  }
  .card {
    width: 630px;
    height: 880px;
    box-sizing: border-box;
    background: maroon;
    color: white;
    font-family: ${monoTextFontStack};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 58px;
    font-weight: 700;
  }
</style>
<div class="card">DEVELOPMENT</div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "630,880" });
  return imageName;
};

const developmentCardBackTexture = async (key, { title, lines }) => {
  const imageName = `${key}-card-back.png`;
  const htmlPath = join(modelsDir, `${key}-card-back.html`);
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 630px;
    height: 880px;
    overflow: hidden;
    background: transparent;
  }
  .card {
    width: 630px;
    height: 880px;
    box-sizing: border-box;
    padding: 120px 48px;
    background: oldlace;
    color: black;
    font-family: ${monoTextFontStack};
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .title {
    margin-bottom: 110px;
    font-size: 46px;
    font-weight: 700;
    line-height: 1.05;
    text-align: center;
  }
  .line {
    margin-top: 32px;
    font-size: 38px;
    line-height: 1;
    text-align: center;
  }
</style>
<div class="card">
  <div class="title">${title.toUpperCase()}</div>
  ${lines.map((line) => `<div class="line">${line.toUpperCase()}</div>`).join("")}
</div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "630,880" });
  return imageName;
};

const awardCardTexture = async (key, { title, color }) => {
  const imageName = `${key}-card.png`;
  const htmlPath = join(modelsDir, `${key}-card.html`);
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
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
    background: ${color};
    color: black;
    font-family: ${monoTextFontStack};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .title {
    margin-bottom: 90px;
    font-size: 78px;
    font-weight: 700;
    line-height: 1.05;
    text-align: center;
  }
  .points {
    font-size: 54px;
    font-weight: 700;
    line-height: 1;
    text-align: center;
  }
</style>
<div class="card"><div class="title">${title.toUpperCase()}</div><div class="points">2 VICTORY POINTS</div></div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "880,1260" });
  return imageName;
};

const tileTexture = async (key, { label, emoji }) => {
  const imageName = `tile-${key}.png`;
  const htmlPath = join(modelsDir, `tile-${key}.html`);
  const imagePath = join(modelsDir, imageName);
  const background = resources[key]?.color ?? "tan";
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 900px;
    height: 900px;
    overflow: hidden;
    background: transparent;
  }
  .face {
    position: relative;
    width: 900px;
    height: 900px;
    background: ${background};
    color: black;
    font-family: ${monoTextEmojiFontStack};
  }
  .emoji, .label {
    position: absolute;
    left: 0;
    width: 900px;
    text-align: center;
    font-weight: 700;
    line-height: 1;
  }
  .emoji {
    top: 100px;
    font-family: ${monoEmojiTextFontStack};
    font-size: 170px;
  }
  .label {
    bottom: 150px;
    font-size: 92px;
  }
</style>
<div class="face">${emoji ? `<div class="emoji">${emoji}</div>` : ""}<div class="label">${label}</div></div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "900,900" });
  return imageName;
};

const harborTexture = async ({ key, label }) => {
  const imageName = `harbor-${key}.png`;
  const htmlPath = join(modelsDir, `harbor-${key}.html`);
  const imagePath = join(modelsDir, imageName);
  const lines = label.split(" ");
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 900px;
    height: 900px;
    overflow: hidden;
    background: transparent;
  }
  .face {
    width: 900px;
    height: 900px;
    background: ${portColor};
    color: white;
    font-family: ${monoTextFontStack};
    font-weight: 700;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .port {
    font-size: 86px;
    line-height: 1;
    margin-bottom: 82px;
  }
  .trade {
    font-size: 66px;
    line-height: 1.15;
  }
</style>
<div class="face"><div class="port">PORT</div><div class="trade">${lines.join("<br>")}</div></div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "900,900" });
  return imageName;
};

const buildingCostTexture = async () => {
  const imageName = "building-cost-card.png";
  const htmlPath = join(modelsDir, "building-cost-card.html");
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
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
    font-family: ${monoTextEmojiFontStack};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  h1 {
    margin: 0 0 50px;
    font-size: 86px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0;
    text-align: center;
  }
  .cost {
    width: 100%;
    text-align: center;
  }
  .label {
    margin-top: 18px;
    font-size: 58px;
    font-weight: 700;
    line-height: 1;
  }
  .icons {
    margin: 12px 0 24px;
    font-family: ${monoEmojiTextFontStack};
    font-size: 74px;
    line-height: 1;
    white-space: nowrap;
  }
</style>
<div class="card">
  <h1>BUILDING COSTS</h1>
  <div class="cost">
    <div class="label">ROAD:</div>
    <div class="icons">🧱🪵</div>
    <div class="label">HOUSE:</div>
    <div class="icons">🧱🪵🐑🌽</div>
    <div class="label">CITY:</div>
    <div class="icons">🌽🌽🪨🪨🪨</div>
    <div class="label">DEVELOPMENT CARD:</div>
    <div class="icons">🐑🌽🪨</div>
  </div>
</div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "880,1260" });
  return imageName;
};

const businessCardTexture = async () => {
  const imageName = "business-card.png";
  const htmlPath = join(modelsDir, "business-card.html");
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 900px;
    height: 550px;
    overflow: hidden;
    background: transparent;
  }
  .card {
    width: 900px;
    height: 550px;
    box-sizing: border-box;
    padding: 46px 58px;
    background: #f7f3e8;
    color: #111;
    font-family: ${monoTextEmojiFontStack};
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  h1 {
    margin: 0 0 28px;
    font-size: 58px;
    line-height: 1;
  }
  .name {
    font-size: 36px;
    line-height: 1;
  }
  .meta {
    margin-top: 44px;
    font-size: 36px;
    line-height: 1;
  }
  .license {
    margin-top: 12px;
    font-size: 36px;
    line-height: 1;
  }
  .rule {
    height: 56px;
    margin: 0;
  }
  .footer {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    font-size: 36px;
    line-height: 1;
    white-space: nowrap;
  }
  .emoji {
    font-family: ${monoEmojiTextFontStack};
    font-size: 36px;
  }
</style>
<div class="card">
  <h1>SETTLERS PROTOTYPE</h1>
  <div class="name">NEFTALY HERNANDEZ</div>
  <div class="meta">DATE: 2026-06-20</div>
  <div class="license">LICENSE: CC BY-SA 4.0</div>
  <div class="rule"></div>
  <div class="footer"><span class="emoji">&#x1F5D1;&#xFE0E;&#x1F4A7;</span><span>https://garbo.succus.games/</span></div>
</div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "900,550" });
  return imageName;
};

const businessCardBackTexture = async () => {
  const imageName = "business-card-back.png";
  const htmlPath = join(modelsDir, "business-card-back.html");
  const imagePath = join(modelsDir, imageName);
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 900px;
    height: 550px;
    overflow: hidden;
    background: transparent;
  }
  .card {
    width: 900px;
    height: 550px;
    box-sizing: border-box;
    background: #050807;
    color: #31d66f;
    font-family: ${monoEmojiTextFontStack};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .emoji {
    font-size: 183px;
    line-height: 1;
  }
</style>
<div class="card"><div class="emoji">&#x1F5D1;&#xFE0E;&#x1F4A7;</div></div>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "900,550" });
  return imageName;
};

const dotCounts = new Map([[2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [8, 5], [9, 4], [10, 3], [11, 2], [12, 1]]);
const counterValues = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

const counterTexture = async (value) => {
  const imageName = `counter-${value}.png`;
  const htmlPath = join(modelsDir, `counter-${value}.html`);
  const imagePath = join(modelsDir, imageName);
  const color = value === 6 || value === 8 ? "firebrick" : "black";
  const count = dotCounts.get(value) ?? 0;
  const dots = "•".repeat(count);

  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  ${monoFontCss}
  html, body {
    margin: 0;
    width: 250px;
    height: 250px;
    overflow: hidden;
    background: transparent;
  }
  svg {
    display: block;
  }
</style>
<svg width="250" height="250" viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg">
  <circle cx="125" cy="125" r="122" fill="linen"/>
  <text x="125" y="126" text-anchor="middle" dominant-baseline="middle"
    style='font-family: ${monoTextFontStack}; font-size: 88px; font-weight: 700; fill: ${color};'>${value}</text>
  <text x="125" y="168" text-anchor="middle" dominant-baseline="middle"
    style='font-family: ${monoTextFontStack}; font-size: 38px; font-weight: 700; letter-spacing: 2px; fill: ${color};'>${dots}</text>
</svg>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: "250,250" });
  return imageName;
};

const rulerTickTexture = async () => {
  const imageName = "ruler-ticks.png";
  const svgPath = join(modelsDir, "ruler-ticks.svg");
  const imagePath = join(modelsDir, imageName);
  const finalImagePath = avifName(imagePath);
  const lengthMm = 205;
  const measuredMm = 200;
  const strokeWidth = 0.18;
  const ticks = [];

  for (let mm = 1; mm <= measuredMm; mm += 1) {
    const isCm = mm % 10 === 0;
    const isHalfCm = mm % 5 === 0;
    const fullTickLength = isCm ? 10 : isHalfCm ? 6 : 3;
    const tickLength = mm <= 5 ? mm : fullTickLength;
    ticks.push(`<line x1="${mm}" y1="0" x2="${mm}" y2="${tickLength}"/>`);
    ticks.push(`<line x1="0" y1="${mm}" x2="${tickLength}" y2="${mm}"/>`);
  }

  await writeFile(svgPath, `
<svg width="1024" height="1024" viewBox="0 0 ${lengthMm} ${lengthMm}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${lengthMm}" height="${lengthMm}" fill="lightskyblue" fill-opacity="0.34"/>
  <g fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="square" shape-rendering="crispEdges">
    ${ticks.join("\n    ")}
  </g>
</svg>
`);
  await exec("magick", [
    "-background",
    "none",
    svgPath,
    "-quality",
    AVIF_QUALITY,
    finalImagePath,
  ]);
  await rm(svgPath, { force: true });
  return imageName;
};

const moldedPlasticNormalTexture = async () => {
  const imageName = "molded-plastic-normal.png";
  const htmlPath = join(modelsDir, "molded-plastic-normal.html");
  const imagePath = join(modelsDir, imageName);
  const tileSize = 256;
  const flecks = Array.from({ length: 520 }, (_, index) => ({
    x: (index * 47) % tileSize,
    y: (index * 83) % tileSize,
    width: 2 + ((index * 11) % 6),
    height: 1 + (index % 2),
    rotation: (index * 29) % 180,
    fill: index % 3 === 0 ? "rgb(176,128,220)" : "rgb(80,128,255)",
    opacity: 0.22 + ((index * 17) % 26) / 100,
  }));
  const stipple = flecks.flatMap((fleck) =>
    [-1, 0, 1].flatMap((xRepeat) =>
      [-1, 0, 1].map((yRepeat) =>
        `<rect x="${fleck.x + xRepeat * tileSize}" y="${fleck.y + yRepeat * tileSize}" width="${fleck.width}" height="${fleck.height}" rx="${fleck.height / 2}" fill="${fleck.fill}" opacity="${fleck.opacity}" transform="rotate(${fleck.rotation} ${fleck.x + xRepeat * tileSize} ${fleck.y + yRepeat * tileSize})"/>`,
      ),
    ),
  ).join("");
  await writeFile(htmlPath, `<!doctype html>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    width: ${tileSize}px;
    height: ${tileSize}px;
    overflow: hidden;
    background: rgb(128, 128, 255);
  }
  svg {
    display: block;
  }
</style>
<svg width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${tileSize}" height="${tileSize}" fill="rgb(128,128,255)"/>
  ${stipple}
</svg>
`);
  await captureTexture({ htmlPath, imagePath, windowSize: `${tileSize},${tileSize}` });
  return imageName;
};

const texturedCard = ({
  imageUri,
  frontImageUri = imageUri,
  backImageUri = imageUri,
  width = 0.088,
  height = 0.126,
  thickness = 0.002,
  materialName = "Textured card face",
  frontMaterialName = `${materialName} front`,
  backMaterialName = `${materialName} back`,
  edgeMaterialName = `${materialName} edge`,
  edgeMaterial = standard(paperEdgeColor, { roughness: 0.86, metalness: 0 }),
  frontMaterial = standard("white", { roughness: 0.8, metalness: 0 }),
  backMaterial = standard("white", { roughness: 0.8, metalness: 0 }),
}) => {
  edgeMaterial.name = edgeMaterialName;
  edgeMaterial.side = THREE.DoubleSide;
  frontMaterial.name = frontMaterialName;
  frontMaterial.side = THREE.DoubleSide;
  backMaterial.name = backMaterialName;
  backMaterial.side = THREE.DoubleSide;
  const result = mesh(cardGeometry(width, height, thickness), [
    edgeMaterial,
    frontMaterial,
    backMaterial,
  ]);
  result.userData.texturePatches = [
    { materialName: frontMaterial.name, imageUri: frontImageUri },
    { materialName: backMaterial.name, imageUri: backImageUri },
  ];
  return result;
};

const texturedHex = ({ color, edgeColor = color, imageUri, materialName }) => {
  const side = standard(edgeColor);
  const face = basic({ color: "white" });
  side.name = `${materialName} side`;
  face.name = materialName;
  const geometry = hexTileGeometry({ radius: 0.045, thickness: 0.002 });
  const result = group(
    mesh(geometry, [side, face, side]),
  );
  result.userData.texturePatch = { materialName: face.name, imageUri };
  return result;
};

const tile = (key, { color }) => texturedHex({
  color,
  edgeColor: paperEdgeColor,
  imageUri: `tile-${key}.png`,
  materialName: `Tile ${key} face`,
});

const harbor = ({ key }) => {
  return texturedHex({
    color: portColor,
    edgeColor: paperEdgeColor,
    imageUri: `harbor-${key}.png`,
    materialName: `Harbor ${key} face`,
  });
};

const counter = (value, imageUri) => {
  const face = basic({ color: "white" });
  face.name = `Counter ${value} face`;
  const result = mesh(coinGeometry({ radius: 0.0125, thickness: 0.002 }), [standard("linen"), face]);
  result.userData.texturePatch = { materialName: face.name, imageUri };
  return result;
};

const lShapeGeometry = ({ length, armWidth, thickness, insideBrace, bevelStartFromBottom }) => {
  const bevelRise = thickness - bevelStartFromBottom;
  const topChamfer = bevelRise;
  const bottomY = -thickness / 2;
  const bevelStartY = bottomY + bevelStartFromBottom;
  const topY = thickness / 2;
  const bottom = [
    [0, 0],
    [length, 0],
    [length, armWidth],
    [armWidth + insideBrace, armWidth],
    [armWidth, armWidth + insideBrace],
    [armWidth, length],
    [0, length],
  ];
  const top = [
    [topChamfer, topChamfer],
    [length, topChamfer],
    [length, armWidth],
    [armWidth + insideBrace, armWidth],
    [armWidth, armWidth + insideBrace],
    [armWidth, length],
    [topChamfer, length],
  ];
  const positions = [];
  const uvs = [];
  const indices = [];
  const point = ([x, z], y) => {
    positions.push(x - length / 2, y, z - length / 2);
    uvs.push(x / length, z / length);
    return positions.length / 3 - 1;
  };
  const bottomIndices = bottom.map((p) => point(p, bottomY));
  const middleIndices = bottom.map((p) => point(p, bevelStartY));
  const topIndices = top.map((p) => point(p, topY));
  const triangles = THREE.ShapeUtils.triangulateShape(bottom.map(([x, z]) => new THREE.Vector2(x, z)), []);
  const topTriangles = THREE.ShapeUtils.triangulateShape(top.map(([x, z]) => new THREE.Vector2(x, z)), []);

  const bottomStart = indices.length;
  for (const [a, b, c] of triangles) {
    indices.push(bottomIndices[a], bottomIndices[b], bottomIndices[c]);
  }
  const bottomCount = indices.length - bottomStart;

  const bodyStart = indices.length;
  for (const [a, b, c] of topTriangles) {
    indices.push(topIndices[c], topIndices[b], topIndices[a]);
  }

  for (let index = 0; index < bottom.length; index += 1) {
    const next = (index + 1) % bottom.length;
    indices.push(bottomIndices[index], middleIndices[next], bottomIndices[next]);
    indices.push(bottomIndices[index], middleIndices[index], middleIndices[next]);
    indices.push(middleIndices[index], topIndices[next], middleIndices[next]);
    indices.push(middleIndices[index], topIndices[index], topIndices[next]);
  }
  const bodyCount = indices.length - bodyStart;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.addGroup(bottomStart, bottomCount, 1);
  geometry.addGroup(bodyStart, bodyCount, 0);
  geometry.computeVertexNormals();
  return geometry;
};

const ruler = () => {
  const length = 0.205;
  const armWidth = 0.03;
  const thickness = 0.0015;
  const insideBrace = 0.01;
  const bevelStartFromBottom = thickness / 2;
  const acrylic = standard("lightskyblue", {
    color: "lightskyblue",
    transparent: true,
    opacity: 0.34,
    roughness: 0.28,
    metalness: 0,
    depthWrite: false,
  });
  const marks = basic({ color: "white", transparent: true });
  marks.name = "Ruler bottom tick marks";
  const result = group(
    mesh(lShapeGeometry({ length, armWidth, thickness, insideBrace, bevelStartFromBottom }), [acrylic, marks]),
  );
  result.userData.texturePatch = { materialName: marks.name, imageUri: "ruler-ticks.png" };
  return result;
};

const flatProfile = (points, depth) => {
  const shape = new THREE.Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, depth });
  geometry.rotateX(Math.PI / 2);
  geometry.rotateY(Math.PI);
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  geometry.translate(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -(min.z + max.z) / 2);
  remapReliefUvs(geometry, [0, 1]);
  return geometry;
};

const remapReliefUvs = (geometry, materialIndices, tileSize = 0.0035) => {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uvs = geometry.getAttribute("uv");
  const indices = geometry.getIndex();

  for (const group of geometry.groups) {
    if (!materialIndices.includes(group.materialIndex)) continue;
    for (let offset = group.start; offset < group.start + group.count; offset += 1) {
      const vertex = indices ? indices.getX(offset) : offset;
      const nx = Math.abs(normals.getX(vertex));
      const ny = Math.abs(normals.getY(vertex));
      const nz = Math.abs(normals.getZ(vertex));
      const u = nx >= ny && nx >= nz
        ? positions.getZ(vertex)
        : positions.getX(vertex);
      const v = ny >= nx && ny >= nz
        ? positions.getZ(vertex)
        : positions.getY(vertex);
      uvs.setXY(
        vertex,
        u / tileSize,
        v / tileSize,
      );
    }
  }
  uvs.needsUpdate = true;
};

const roofFlatHalfLength = (halfLength, rise) =>
  (Math.sqrt(4 * halfLength ** 2 + 3 * rise ** 2) - halfLength) / 3;

const pieceFace = standard("white", { roughness: 0.68, metalness: 0 });
pieceFace.name = "Molded plastic face";
const pieceSide = standard("gainsboro", { roughness: 0.72, metalness: 0 });
pieceSide.name = "Molded plastic side";
const pieceEnd = standard("whitesmoke", { roughness: 0.68, metalness: 0 });
pieceEnd.name = "Molded plastic end";
const pieceMaterials = [pieceFace, pieceSide];
const moldedPlasticNormalPatch = (material) => ({
  materialName: material.name,
  normalUri: "molded-plastic-normal.png",
  normalScale: 0.9,
  repeat: true,
});

const road = () => {
  const geometry = new THREE.BoxGeometry(0.025, 0.004, 0.004);
  remapReliefUvs(geometry, [0, 1, 2, 3, 4, 5]);
  const result = group(mesh(geometry, [pieceEnd, pieceEnd, pieceFace, pieceSide, pieceSide, pieceSide]));
  result.userData.texturePatches = [
    moldedPlasticNormalPatch(pieceEnd),
    moldedPlasticNormalPatch(pieceFace),
    moldedPlasticNormalPatch(pieceSide),
  ];
  return result;
};

const house = () => {
  const halfLength = 0.007;
  const roofRise = 0.005;
  const wallHeight = 0.007;
  const height = wallHeight + roofRise;
  const result = group(mesh(flatProfile([
    [-halfLength, 0],
    [-halfLength, wallHeight],
    [0, height],
    [halfLength, wallHeight],
    [halfLength, 0],
  ], 0.01), pieceMaterials));
  result.userData.texturePatches = [
    moldedPlasticNormalPatch(pieceFace),
    moldedPlasticNormalPatch(pieceSide),
  ];
  return result;
};

const settlement = () => {
  const bodyHalfLength = 0.0035;
  const roofRise = 0.0025;
  const wallHeight = 0.0145;
  const abutmentHeight = 0.008;
  const abutmentEnd = 0.0125;
  const height = wallHeight + roofRise;
  const roofHalfLength = roofFlatHalfLength(bodyHalfLength, roofRise);
  const result = group(mesh(flatProfile([
    [-bodyHalfLength, 0],
    [-bodyHalfLength, wallHeight],
    [-roofHalfLength, height],
    [roofHalfLength, height],
    [bodyHalfLength, wallHeight],
    [bodyHalfLength, abutmentHeight],
    [abutmentEnd, abutmentHeight],
    [abutmentEnd, 0],
  ], 0.01), pieceMaterials));
  result.userData.texturePatches = [
    moldedPlasticNormalPatch(pieceFace),
    moldedPlasticNormalPatch(pieceSide),
  ];
  return result;
};

// tapered square shaft with a single flat chamfer on each vertical edge, so
// the cross-section is an octagon (square with cut corners). Base/top widths
// and bevel are in metres; the base ring sits on the tile at y=0.
const obeliskGeometry = ({ baseWidth, topWidth, bevel, height }) => {
  const ring = (width, y) => {
    const h = width / 2;
    const a = h - bevel;
    return [
      [a, y, h], [h, y, a], [h, y, -a], [a, y, -h],
      [-a, y, -h], [-h, y, -a], [-h, y, a], [-a, y, h],
    ];
  };
  const base = ring(baseWidth, 0);
  const top = ring(topWidth, height);
  const positions = [];
  // push a triangle, flipping its winding if it faces away from `outward`
  const pushTri = (p, q, r, outward) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2];
    const vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const tri = nx * outward[0] + ny * outward[1] + nz * outward[2] < 0 ? [p, r, q] : [p, q, r];
    for (const v of tri) positions.push(v[0], v[1], v[2]);
  };
  for (let i = 0; i < 8; i += 1) {
    const j = (i + 1) % 8;
    const outward = [base[i][0] + base[j][0], 0, base[i][2] + base[j][2]];
    pushTri(base[i], base[j], top[j], outward);
    pushTri(base[i], top[j], top[i], outward);
    pushTri([0, height, 0], top[i], top[j], [0, 1, 0]);
    pushTri([0, 0, 0], base[i], base[j], [0, -1, 0]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

const obeliskFootCapGeometry = ({ width, bevel }) => {
  const h = width / 2;
  const a = h - bevel;
  const ring = [
    [a, 0, h], [h, 0, a], [h, 0, -a], [a, 0, -h],
    [-a, 0, -h], [-h, 0, -a], [-h, 0, a], [-a, 0, h],
  ];
  const positions = [];
  for (let index = 0; index < ring.length; index += 1) {
    const nextIndex = (index + 1) % ring.length;
    positions.push(0, 0, 0, ring[index][0], 0, ring[index][2], ring[nextIndex][0], 0, ring[nextIndex][2]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
};

const robber = () => {
  const plastic = new THREE.MeshPhysicalMaterial({
    color: "indigo",
    metalness: 0,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 0.9,
    iridescenceIOR: 1.8,
    iridescenceThicknessRange: [120, 720],
    specularIntensity: 1,
    specularColor: "mediumspringgreen",
  });
  return group(
    mesh(obeliskGeometry({ baseWidth: 0.025, topWidth: 0.015, bevel: 0.005, height: 0.03 }), plastic),
    mesh(obeliskFootCapGeometry({ width: 0.025, bevel: 0.005 }), plastic, [0, 0.00008, 0]),
  );
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
  const texturePatches = object.userData.texturePatches ?? (object.userData.texturePatch ? [object.userData.texturePatch] : []);

  if (texturePatches.length > 0) {
    output.images ??= [];
    output.textures ??= [];
    output.samplers ??= [];
    output.extensionsUsed ??= [];
    output.extensionsRequired ??= [];
    const addAvifTexture = (imageUri, { repeat = false } = {}) => {
      const samplerIndex = output.samplers.push({
        magFilter: GLTF_LINEAR_FILTER,
        minFilter: GLTF_LINEAR_MIPMAP_LINEAR_FILTER,
        wrapS: repeat ? GLTF_REPEAT : GLTF_CLAMP_TO_EDGE,
        wrapT: repeat ? GLTF_REPEAT : GLTF_CLAMP_TO_EDGE,
      }) - 1;
      const imageIndex = output.images.push({ uri: avifName(imageUri) }) - 1;
      return output.textures.push({
        sampler: samplerIndex,
        extensions: {
          EXT_texture_avif: { source: imageIndex },
        },
      }) - 1;
    };
    if (!output.extensionsUsed.includes("EXT_texture_avif")) {
      output.extensionsUsed.push("EXT_texture_avif");
    }
    if (!output.extensionsRequired.includes("EXT_texture_avif")) {
      output.extensionsRequired.push("EXT_texture_avif");
    }
    for (const texturePatch of texturePatches) {
      const materialIndex = output.materials?.findIndex((material) => material.name === texturePatch.materialName);
      if (materialIndex === undefined || materialIndex < 0) {
        throw new Error(`Missing texture patch material ${texturePatch.materialName}`);
      }
      output.materials[materialIndex].pbrMetallicRoughness ??= {};
      if (texturePatch.imageUri !== undefined) {
        const textureIndex = addAvifTexture(texturePatch.imageUri, { repeat: texturePatch.repeat === true });
        output.materials[materialIndex].pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
        output.materials[materialIndex].pbrMetallicRoughness.baseColorTexture = { index: textureIndex };
        output.materials[materialIndex].doubleSided = true;
      }
      if (texturePatch.normalUri !== undefined) {
        const textureIndex = addAvifTexture(texturePatch.normalUri, { repeat: texturePatch.repeat === true });
        output.materials[materialIndex].normalTexture = {
          index: textureIndex,
          scale: texturePatch.normalScale ?? 1,
        };
      }
    }
    for (const node of output.nodes ?? []) {
      delete node.extras?.texturePatch;
      delete node.extras?.texturePatches;
      if (node.extras && Object.keys(node.extras).length === 0) delete node.extras;
    }
  }

  for (const [index, buffer] of (output.buffers ?? []).entries()) {
    if (!buffer.uri?.startsWith("data:")) continue;
    const bin = dataUriToBuffer(buffer.uri);
    const hash = createHash("sha256").update(bin).digest("hex").slice(0, 16);
    const binName = `buffer-${hash}.bin`;
    await writeFile(join(modelsDir, binName), bin);
    buffer.uri = binName;
    buffer.byteLength = bin.byteLength;
  }

  await writeFile(join(modelsDir, name), `${JSON.stringify(output, null, 2)}\n`);
};

const resources = {
  brick: { label: "BRICK", color: "peru", text: "saddlebrown", emoji: "🧱" },
  corn: { label: "CORN", color: "gold", text: "darkgoldenrod", emoji: "🌽" },
  timber: { label: "TIMBER", color: "seagreen", text: "darkgreen", emoji: "🪵" },
  ore: { label: "ORE", color: "slategray", text: "black", emoji: "🪨" },
  wool: { label: "WOOL", color: "yellowgreen", text: "darkolivegreen", emoji: "🐑" },
};
const developmentCards = {
  knight: { title: "KNIGHT", lines: ["MOVE ROBBER", "STEAL 1 CARD", "FROM NEIGHBOR"] },
  "road-building": { title: "ROAD BUILDING", lines: ["PLACE 2 ROADS", "FOR FREE"] },
  "year-of-plenty": { title: "YEAR OF PLENTY", lines: ["TAKE ANY 2", "RESOURCE CARDS", "FROM PILE"] },
  monopoly: { title: "MONOPOLY", lines: ["NAME RESOURCE", "ALL PLAYERS", "GIVE YOU THEIRS"] },
  chapel: { title: "CHAPEL", lines: ["KEEP HIDDEN", "+1 POINT"] },
  "great-hall": { title: "GREAT HALL", lines: ["KEEP HIDDEN", "+1 POINT"] },
  library: { title: "LIBRARY", lines: ["KEEP HIDDEN", "+1 POINT"] },
  market: { title: "MARKET", lines: ["KEEP HIDDEN", "+1 POINT"] },
  university: { title: "UNIVERSITY", lines: ["KEEP HIDDEN", "+1 POINT"] },
};
const awardCards = {
  "largest-army": { title: "LARGEST ARMY", color: "lightpink" },
  "longest-road": { title: "LONGEST ROAD", color: "paleturquoise" },
};
const harbors = [
  { key: "3-1", label: "ANY 3:1" },
  { key: "brick", label: "BRICK 2:1" },
  { key: "corn", label: "CORN 2:1" },
  { key: "timber", label: "TIMBER 2:1" },
  { key: "ore", label: "ORE 2:1" },
  { key: "wool", label: "WOOL 2:1" },
];
const oceanColor = "steelblue";
const portColor = "cadetblue";

const assets = [
  ["ocean.gltf", () => cuttingMat()],
  ...Object.keys(resources).map((key) => [`resource-card-${key}.gltf`, () => resourceCard(key)]),
  ...Object.keys(developmentCards).map((key) => [`${key}-card.gltf`, () => actionCard(key)]),
  ...Object.keys(awardCards).map((key) => [`${key}-card.gltf`, () => awardCard(key)]),
  ["building-cost-card.gltf", () => texturedCard({ imageUri: "building-cost-card.png", materialName: "Building cost card face" })],
  ["business-card.gltf", () => texturedCard({
    frontImageUri: "business-card.png",
    backImageUri: "business-card-back.png",
    width: 0.09,
    height: 0.055,
    thickness: 0.00035,
    materialName: "Business card face",
    backMaterial: standard("white", { roughness: 0.28, metalness: 0 }),
  })],
  ...Object.entries(resources).map(([key, spec]) => [`tile-${key}.gltf`, () => tile(key, spec)]),
  ["tile-desert.gltf", () => tile("desert", { label: "DESERT", color: "tan" })],
  ...harbors.map(({ key }) => [`harbor-${key}.gltf`, () => harbor({ key })]),
  ...counterValues.map((value) => [`counter-${value}.gltf`, () => counter(value, `counter-${value}.png`)]),
  ["robber.gltf", robber],
  ["road.gltf", road],
  ["settlement.gltf", settlement],
  ["house.gltf", house],
  ["ruler.gltf", ruler],
];

await rm(modelsDir, { recursive: true, force: true });
await mkdir(modelsDir, { recursive: true });
await moldedPlasticNormalTexture();
await buildingCostTexture();
await businessCardTexture();
await businessCardBackTexture();
await rulerTickTexture();
await resourceCardFrontTexture();
for (const [key, spec] of Object.entries(resources)) {
  await resourceCardBackTexture(key, spec);
}
await developmentCardFrontTexture();
for (const [key, spec] of Object.entries(developmentCards)) {
  await developmentCardBackTexture(key, spec);
}
for (const [key, spec] of Object.entries(awardCards)) {
  await awardCardTexture(key, spec);
}
for (const [key, spec] of Object.entries(resources)) {
  await tileTexture(key, spec);
}
await tileTexture("desert", { label: "DESERT" });
for (const harbor of harbors) {
  await harborTexture(harbor);
}
for (const value of counterValues) {
  await counterTexture(value);
}
await Promise.all(assets.map(([name, build]) => exportGltf(name, build())));

console.log(`Generated ${assets.length} GLTF assets in dist/models/`);
