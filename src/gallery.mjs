export function renderGallery(paths) {
  const blocks = [
    '# Game assets',
    '## 3D robber',
    '[Robber glTF](svg/robber/robber.gltf) — keep [robber.bin](svg/robber/robber.bin) beside it when importing; the SVG alternative is in the same folder.',
  ];
  let previousFolder;
  for (const path of [...paths].sort()) {
    const folder = path.slice(0, path.lastIndexOf('/'));
    if (folder !== previousFolder) {
      blocks.push(`## ${folder}`);
      previousFolder = folder;
    }
    blocks.push(`![${path}](svg/${path})`);
  }
  return `${blocks.join('\n\n')}\n`;
}
