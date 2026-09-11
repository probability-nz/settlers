import React, { useMemo } from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Geometry and material parameters preserved from the original robber generator.
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

function createRobberGeometry() {
  const body = obeliskGeometry({ baseWidth: 0.025, topWidth: 0.015, bevel: 0.005, height: 0.03 });
  // Index identical vertices while retaining the original flat face normals.
  const geometry = mergeVertices(body, 1e-7);
  body.dispose();
  return geometry;
}

export function Robber() {
  const geometry = useMemo(createRobberGeometry, []);
  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color="indigo"
        metalness={0}
        roughness={0.28}
        clearcoat={1}
        clearcoatRoughness={0.08}
        iridescence={0.9}
        iridescenceIOR={1.8}
        iridescenceThicknessRange={[120, 720]}
        specularIntensity={1}
        specularColor="mediumspringgreen"
      />
    </mesh>
  );
}
