import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderSvg } from './render-svg.mjs';
import { renderGallery } from './gallery.mjs';
import { Asset } from './assets.jsx';
import { Fonts } from './svg.jsx';
import { loadCatalogue } from './catalogue.mjs';
import { loadFonts } from './fonts.mjs';

const outputDirectory = fileURLToPath(new URL('../dist/svg/', import.meta.url));
const galleryPath = join(outputDirectory, '../README.md');
await rm(galleryPath, { force: true });
await rm(outputDirectory, { recursive: true, force: true });

try {
  const [assets, fonts] = await Promise.all([
    loadCatalogue(process.argv[2]),
    loadFonts(),
  ]);
  await mkdir(outputDirectory, { recursive: true });

  for (const asset of assets) {
    const path = join(outputDirectory, asset.path);
    const svg = renderSvg(
      <Fonts.Provider value={fonts}>
        <Asset asset={asset} />
      </Fonts.Provider>,
    );
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${svg}\n`);
  }

  await writeFile(galleryPath, renderGallery(assets.map(asset => asset.path)));

  console.log(`Exported ${assets.length} self-contained SVGs to ${outputDirectory}`);
} catch (error) {
  await rm(galleryPath, { force: true });
  await rm(outputDirectory, { recursive: true, force: true });
  throw error;
}
