import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Asset } from './assets.jsx';
import { Fonts } from './svg.jsx';
import { loadCatalogue } from './catalogue.mjs';
import { loadFonts } from './fonts.mjs';
import { Rules } from './assets/rules.jsx';

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

  const rulesPath = join(outputDirectory, 'cards/reference/rules.svg');
  await mkdir(dirname(rulesPath), { recursive: true });
  const rules = renderToStaticMarkup(<Fonts.Provider value={fonts}><Rules /></Fonts.Provider>);
  await writeFile(rulesPath, `${rules}\n`, { flag: 'wx' });

  console.log(`Exported ${assets.length + 1} self-contained SVGs to ${outputDirectory}`);
} catch (error) {
  await rm(outputDirectory, { recursive: true, force: true });
  throw error;
}
