import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { templates } from './assets.jsx';

const defaultInput = new URL('./data/components.csv', import.meta.url);
const counterValues = new Set([2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);

function parseRow(row) {
  if (!Object.hasOwn(templates, row.template)) {
    throw new Error(`unknown template "${row.template}"`);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(row.nickname ?? '')) {
    throw new Error('nickname must use lowercase letters, digits, underscores or hyphens');
  }
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/u.test(row.folder ?? '')) {
    throw new Error('folder must be a relative path of simple names');
  }

  const copies = row.copies ? Number(row.copies) : 1;
  if (!Number.isInteger(copies) || copies < 0 || copies > 1000) {
    throw new Error('copies must be an integer from 0 to 1000');
  }
  if (/(?:^|[_-])back(?:$|[_-])/u.test(row.nickname) && copies > 1) {
    throw new Error('a shared back must have at most one copy');
  }

  for (const field of templates[row.template].required ?? []) {
    if (!row[field]) throw new Error(`missing ${field}`);
  }

  for (const field of ['color', 'fill']) {
    if (/url\s*\(|\\|\/\*/iu.test(row[field] ?? '')) {
      throw new Error(`${field} must be a color without URLs, CSS escapes or comments`);
    }
  }

  const size = row.size ? Number(row.size) : undefined;
  if (size !== undefined && (!Number.isFinite(size) || size <= 0)) {
    throw new Error('size must be a positive number');
  }
  const value = Number(row.value);
  if (row.template === 'counter' && !counterValues.has(value)) {
    throw new Error('counter value must be 2–12, excluding 7');
  }

  const [width, height] = templates[row.template].dimensions;
  return {
    ...row,
    kind: row.template,
    copies,
    width,
    height,
    value,
    size,
    fill: row.fill || undefined,
  };
}

export function parseCatalogue(source) {
  const rows = parse(source, {
    columns: headers => {
      const duplicate = headers.find((header, index) => headers.indexOf(header) !== index);
      if (duplicate !== undefined) throw new Error(`duplicate CSV column "${duplicate}"`);
      return headers;
    },
    bom: true,
    skip_empty_lines: true,
    trim: true,
  });
  const assets = [];
  const paths = new Set();

  for (const [index, row] of rows.entries()) {
    try {
      const asset = parseRow(row);

      // Probability imports each file as one piece, so expand quantities here.
      for (let copy = 1; copy <= asset.copies; copy++) {
        const suffix = asset.copies > 1 ? `_${String(copy).padStart(3, '0')}` : '';
        const name = `${row.nickname}${suffix}`;
        const path = `${row.folder}/${name}.svg`;
        if (paths.has(path)) throw new Error(`duplicate output path ${path}`);

        paths.add(path);
        assets.push({ ...asset, name, path });
      }
    } catch (error) {
      throw new Error(`CSV row ${index + 2} (${row.nickname || 'unnamed'}): ${error.message}`);
    }
  }

  return assets;
}

export async function loadCatalogue(input = defaultInput) {
  const source = await readFile(input, 'utf8');
  return parseCatalogue(source);
}
