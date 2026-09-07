export function renderGallery(paths) {
  const blocks = ['# SVG list'];
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
