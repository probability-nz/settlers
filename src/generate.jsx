import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Asset } from './assets.jsx';
import { Fonts } from './svg.jsx';
import { loadCatalogue } from './catalogue.mjs';
import { loadFonts } from './fonts.mjs';

const outputDirectory = fileURLToPath(new URL('../dist/svg/', import.meta.url));
await rm(outputDirectory, { recursive: true, force: true });

try {
  const [assets, fonts] = await Promise.all([
    loadCatalogue(process.argv[2]),
    loadFonts(),
  ]);

  for (const asset of assets) {
    const path = join(outputDirectory, asset.path);
    const svg = renderToStaticMarkup(
      <Fonts.Provider value={fonts}>
        <Asset asset={asset} />
      </Fonts.Provider>,
    );
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${svg}\n`);
  }

  console.log(`Exported ${assets.length} self-contained SVGs to ${outputDirectory}`);
} catch (error) {
  await rm(outputDirectory, { recursive: true, force: true });
  throw error;
}
