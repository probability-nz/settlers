import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderSvg } from '../src/render-svg.mjs';
import { renderGallery } from '../src/gallery.mjs';
import { DOMParser } from '@xmldom/xmldom';
import { loadCatalogue, parseCatalogue } from '../src/catalogue.mjs';
import { loadFonts } from '../src/fonts.mjs';
import { Fonts, Text, Svg } from '../src/svg.jsx';
import { Asset, templates } from '../src/assets.jsx';

const outputDirectory = new URL('../dist/svg/', import.meta.url);
const svgNamespace = 'http://www.w3.org/2000/svg';
const allowedElements = new Set([
  'svg', 'title', 'g', 'path', 'polygon', 'rect', 'circle', 'line', 'defs', 'use',
]);

test('generated robber preserves dimensions, triangles and purple/green physical material', async () => {
  const { renderRobberGltf } = await import('../src/render-gltf.jsx');
  const source = await readFile(new URL('robber/robber.gltf', outputDirectory), 'utf8');
  const generated = await renderRobberGltf();
  assert.equal(source, generated.gltf, 'stale model; regenerate assets');
  const model = JSON.parse(source);
  assert.equal(model.asset.version, '2.0');
  assert.equal(model.scenes[model.scene].name, 'robber');
  assert.equal(model.meshes.length, 1);
  const primitive = model.meshes[0].primitives[0];
  assert.equal(model.accessors[primitive.indices].count, 96, '32 body triangles, including the bottom face, without the extra cap');
  const positions = model.accessors[primitive.attributes.POSITION];
  for (const [actual, expected] of [
    ...positions.min.map((value, index) => [value, [-0.0125, 0, -0.0125][index]]),
    ...positions.max.map((value, index) => [value, [0.0125, 0.03, 0.0125][index]]),
  ]) assert.ok(Math.abs(actual - expected) < 1e-8);
  const material = model.materials[primitive.material];
  assert.deepEqual(material.pbrMetallicRoughness, {
    baseColorFactor: [0.07036009568874305, 0, 0.22322795730611386, 1],
    metallicFactor: 0,
    roughnessFactor: 0.28,
  });
  assert.deepEqual(material.extensions, {
    KHR_materials_clearcoat: { clearcoatFactor: 1, clearcoatRoughnessFactor: 0.08 },
    KHR_materials_iridescence: {
      iridescenceFactor: 0.9, iridescenceIor: 1.8,
      iridescenceThicknessMinimum: 120, iridescenceThicknessMaximum: 720,
    },
    KHR_materials_specular: { specularFactor: 1, specularColorFactor: [0, 0.9559733532482866, 0.3231432091022285] },
  });
  for (const buffer of model.buffers) {
    assert.equal(buffer.uri, 'robber.bin');
    const exported = await readFile(new URL(`robber/${buffer.uri}`, outputDirectory));
    assert.equal(exported.byteLength, buffer.byteLength);
    assert.deepEqual(exported, generated.buffer, 'stale mesh buffer; regenerate assets');
  }
  assert.equal(source, `${JSON.stringify(model)}\n`, 'JSON is minified');
  assert.ok(!(model.images?.length), 'robber material has no image textures');
  const robber = (await loadCatalogue()).find(asset => asset.kind === 'robber');
  assert.equal(robber.path, 'robber/robber_25mm_001.svg');
  assert.deepEqual((await readdir(new URL('robber/', outputDirectory))).sort(), [
    'robber.bin', 'robber.gltf', 'robber_25mm_001.svg',
  ]);
});

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
  const render = (...children) => renderSvg(
    createElement(Fonts.Provider, { value: fonts }, createElement(Svg, { width: 40, height: 40 }, ...children)),
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

test('glyph definitions are reused across text components and sizes', async () => {
  const fonts = await loadFonts();
  const element = createElement(Fonts.Provider, { value: fonts },
    createElement(Svg, { width: 40, height: 40 },
      createElement(Text, { x: 10, y: 10, size: 4 }, 'AA'),
      createElement(Text, { x: 10, y: 20, size: 8 }, 'A'),
      createElement(Text, { x: 10, y: 30, size: 4, bold: true }, 'A')));
  const raw = renderToStaticMarkup(element);
  assert.equal(parseSvg(raw).getElementsByTagName('path').length, 4);
  assert.equal(parseSvg(raw).getElementsByTagName('use').length, 0);
  const source = renderSvg(element);
  assert.equal(renderSvg(element), source, 'repeated exports do not retain state');
  assert.equal(renderToStaticMarkup(element), raw, 'export does not change React rendering');
  const document = parseSvg(source);
  assert.equal(document.getElementsByTagName('path').length, 2);
  const uses = Array.from(document.getElementsByTagName('use'));
  assert.deepEqual(uses.map(use => use.getAttribute('href')), ['#glyph0', '#glyph0', '#glyph0', '#glyph1']);
});

test('thickness is encoded before the copy number, including single cards', () => {
  const header = 'nickname,template,folder,copies,thickness';
  const assets = parseCatalogue(`${header}\nexample,cutting-mat,test,2,0.6\nsingle,cutting-mat,test,1,2`);
  assert.deepEqual(assets.map(asset => asset.path), [
    'test/example_0.6mm_001.svg', 'test/example_0.6mm_002.svg', 'test/single_2mm_001.svg',
  ]);
  const pattern = /[\W_](\d+(?:\.\d+)?)mm[\W_]\d+\.svg$/i;
  for (const name of ['brick_0.6mm_002.svg', 'brick 0.6MM-002.svg', 'brick.0.6mm.002.svg', 'brick@0.6MM!002.svg']) {
    assert.equal(name.match(pattern)?.[1], '0.6');
  }
  for (const thickness of ['0', '-1', 'NaN', 'Infinity', '0.6mm', '1e3']) {
    assert.throws(() => parseCatalogue(`${header}\nx,cutting-mat,test,1,${thickness}`), /thickness/);
  }
  for (const thickness of ['0.0000001', '1000000000000000000000']) {
    const [asset] = parseCatalogue(`${header}\nx,cutting-mat,test,1,${thickness}`);
    assert.equal(asset.path.match(pattern)?.[1], thickness, 'decimal thickness survives filename round-trip');
  }
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
  const gallery = await readFile(new URL('../dist/README.md', import.meta.url), 'utf8');
  assert.equal(gallery, renderGallery(files), 'stale or modified gallery; regenerate assets');
  const embeddedPaths = [...gallery.matchAll(/!\[[^\]]*\]\(svg\/([^)]+)\)/gu)].map(match => match[1]);
  assert.deepEqual(embeddedPaths.sort(), files.sort(), 'gallery embeds every exported SVG exactly once');

  for (const asset of assets) {
    const source = await readFile(new URL(asset.path, outputDirectory), 'utf8');
    const expected = renderSvg(
      createElement(Fonts.Provider, { value: fonts }, createElement(Asset, { asset })),
    ) + '\n';
    assert.equal(source, expected, `${asset.path}: stale or modified export; regenerate assets`);
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
        if (attribute.name === 'href') {
          assert.match(attribute.value, /^#glyph\d+$/u);
          assert.ok(document.getElementById(attribute.value.slice(1)), 'glyph reference resolves inside this SVG');
        } else assert.ok(!/^(?:on|href|style)/iu.test(attribute.name));
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
    const source = renderSvg(
      createElement(Fonts.Provider, { value: fonts }, createElement(Asset, { asset })),
    );
    const root = parseSvg(source).documentElement;
    assert.equal(root.getAttribute('width'), `${width}mm`);
    assert.equal(root.getAttribute('height'), `${height}mm`);
    assert.equal(root.getAttribute('viewBox'), `${origin} ${width} ${height}`);
  }
});
