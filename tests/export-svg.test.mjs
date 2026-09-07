import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DOMParser } from '@xmldom/xmldom';
import { loadCatalogue, parseCatalogue } from '../src/catalogue.mjs';
import { loadFonts } from '../src/fonts.mjs';
import { Fonts, Text } from '../src/svg.jsx';
import { Asset, templates } from '../src/assets.jsx';

const outputDirectory = new URL('../dist/svg/', import.meta.url);
const svgNamespace = 'http://www.w3.org/2000/svg';
const allowedElements = new Set([
  'svg', 'title', 'g', 'path', 'polygon', 'rect', 'circle', 'line',
]);

function parseSvg(source) {
  const errors = [];
  const recordError = message => errors.push(message);
  const parser = new DOMParser({
    errorHandler: {
      warning: recordError,
      error: recordError,
      fatalError: recordError,
    },
  });
  const document = parser.parseFromString(source, 'image/svg+xml');
  assert.deepEqual(errors, []);
  return document;
}

test('CSV supports spreadsheet BOMs, quoted commas, multiline text and quantities', () => {
  const source = [
    '\uFEFFnickname,template,folder,copies,title,text',
    'example,development,cards/test,2,"A, B","FIRST LINE\n\nSECOND LINE"',
  ].join('\r\n');
  const assets = parseCatalogue(source);

  assert.deepEqual(assets.map(asset => asset.path), [
    'cards/test/example_001.svg',
    'cards/test/example_002.svg',
  ]);
  assert.equal(assets[0].title, 'A, B');
  assert.equal(assets[0].text, 'FIRST LINE\n\nSECOND LINE');
});

test('multiline text preserves blank lines and selects the emoji font', async () => {
  const fonts = await loadFonts();
  const render = (...children) => renderToStaticMarkup(
    createElement(Fonts.Provider, { value: fonts }, ...children),
  );
  const props = { x: 20, y: 10, size: 4, lineHeight: 5 };
  assert.equal(
    render(createElement(Text, props, 'A\n\n🧱')),
    render(
      createElement(Text, props, 'A'),
      createElement(Text, { ...props, y: 20, emoji: true }, '🧱'),
    ),
  );
});

test('invalid spreadsheet data fails before export', () => {
  const header = 'nickname,template,folder,copies';
  const invalidRows = [
    'x,nope,cards,1',
    'x,cutting-mat,../outside,1',
    'x,cutting-mat,cards,1.5',
    'x_back,cutting-mat,cards,2',
  ];
  for (const row of invalidRows) {
    assert.throws(() => parseCatalogue(`${header}\n${row}`), /CSV row 2/);
  }

  const duplicateRows = [header, 'x,cutting-mat,cards,1', 'x,cutting-mat,cards,1'];
  assert.throws(() => parseCatalogue(duplicateRows.join('\n')), /duplicate output/);
  assert.equal(parseCatalogue(`${header}\nx,cutting-mat,cards,0`).length, 0);
});

test('CSV paint fields reject resource references before rendering', () => {
  for (const field of ['color', 'fill']) {
    for (const paint of ['url(https://example.com/paint.svg#x)', 'URL (#x)', String.raw`u\72l(#x)`, 'u/**/rl(#x)']) {
      assert.throws(
        () => parseCatalogue(`nickname,template,folder,${field}\nx,cutting-mat,tools,${paint}`),
        new RegExp(`CSV row 2.*${field} must be a color`),
      );
    }
  }
});

test('duplicate CSV columns cannot silently overwrite content or quantities', () => {
  for (const field of ['copies', 'title']) {
    assert.throws(
      () => parseCatalogue(`nickname,template,folder,${field},${field}\nx,cutting-mat,tools,5,0`),
      new RegExp(`duplicate CSV column "${field}"`),
    );
  }
});

test('exports match the current source and contain well-formed, self-contained vectors', async () => {
  const assets = await loadCatalogue();
  const fonts = await loadFonts();
  const entries = await readdir(outputDirectory, { recursive: true });
  const files = entries.filter(file => file.endsWith('.svg'));
  assert.deepEqual(files.sort(), assets.map(asset => asset.path).sort());

  for (const asset of assets) {
    const source = await readFile(new URL(asset.path, outputDirectory), 'utf8');
    const expected = renderToStaticMarkup(
      createElement(Fonts.Provider, { value: fonts }, createElement(Asset, { asset })),
    );
    assert.equal(source, `${expected}\n`, `${asset.path}: stale or modified export; regenerate assets`);
    const document = parseSvg(source);
    const root = document.documentElement;

    assert.equal(root.namespaceURI, svgNamespace);
    const origin = templates[asset.kind].origin ?? [0, 0];
    assert.equal(root.getAttribute('viewBox'), `${origin.join(' ')} ${asset.width} ${asset.height}`);
    assert.equal(root.getAttribute('width'), `${asset.width}mm`);
    assert.equal(root.getAttribute('height'), `${asset.height}mm`);
    assert.ok(Buffer.byteLength(source) < 16 * 1024 * 1024);

    for (const element of Array.from(document.getElementsByTagName('*'))) {
      assert.ok(allowedElements.has(element.tagName), `${asset.path}: ${element.tagName}`);
      for (const attribute of Array.from(element.attributes)) {
        assert.ok(!/^(?:on|href|style)/iu.test(attribute.name));
        assert.ok(!/url\s*\(|NaN|Infinity/u.test(attribute.value));
      }
    }
  }
});

test('physical dimensions and viewBox coordinates use millimetres directly', async () => {
  const fonts = await loadFonts();
  const sizes = [
    ['back', 63, 88],
    ['counter', 24.4, 24.4, '0.3 0.3'],
    ['counter-back', 24.4, 24.4, '0.3 0.3'],
    ['tile', 77.9422, 90, '6.0289 0'],
    ['harbor', 77.9422, 90, '6.0289 0'],
    ['road', 25, 4],
    ['ruler', 205, 205],
    ['cutting-mat', 841, 594],
  ];
  for (const [template, width, height, origin = '0 0'] of sizes) {
    const [asset] = parseCatalogue(`nickname,template,folder,label,color,size,value,title,text\nexample,${template},test,TEST,linen,7.8,2,PORT,2:1`);
    const source = renderToStaticMarkup(
      createElement(Fonts.Provider, { value: fonts }, createElement(Asset, { asset })),
    );
    const root = parseSvg(source).documentElement;
    assert.equal(root.getAttribute('width'), `${width}mm`);
    assert.equal(root.getAttribute('height'), `${height}mm`);
    assert.equal(root.getAttribute('viewBox'), `${origin} ${width} ${height}`);
  }
});
