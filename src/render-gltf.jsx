import React from 'react';
import { create } from '@react-three/test-renderer';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Scene } from 'three';
import { Robber } from './assets/robber.jsx';

// GLTFExporter uses the browser FileReader API, including for embedded buffers.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    this.read(blob, buffer => buffer);
  }

  readAsDataURL(blob) {
    this.read(blob, buffer => `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`);
  }

  read(blob, convert) {
    blob.arrayBuffer().then(buffer => {
      this.result = convert(buffer);
      this.onloadend?.();
    }, error => {
      this.error = error;
      this.onerror?.(error);
    });
  }
};

export async function renderRobberGltf() {
  // Fiber's headless renderer builds the real Three.js scene without a browser/GPU.
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer;
  try {
    renderer = await create(<Robber />);
    // Use the exporter's ESM Scene class (the headless renderer may use Three's CJS build).
    const scene = new Scene();
    scene.add(...renderer.scene.instance.children.map(child => child.clone()));
    scene.name = 'robber';
    const gltf = await new GLTFExporter().parseAsync(scene, { binary: false });
    const buffer = Buffer.from(gltf.buffers[0].uri.split(',')[1], 'base64');
    gltf.buffers[0].uri = 'robber.bin';
    return { gltf: `${JSON.stringify(gltf)}\n`, buffer };
  } finally {
    await renderer?.unmount();
    if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
}
