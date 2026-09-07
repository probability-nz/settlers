import { renderToStaticMarkup } from 'react-dom/server';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

// React renders independently; only the export step collects repeated glyphs.
export function renderSvg(element) {
  const document = new DOMParser().parseFromString(renderToStaticMarkup(element), 'image/svg+xml');
  const root = document.documentElement;
  const definitions = document.createElementNS(root.namespaceURI, 'defs');
  const glyphs = new Map();
  for (const path of Array.from(document.getElementsByTagName('path'))) {
    if (!path.hasAttribute('data-glyph')) continue;
    const d = path.getAttribute('d');
    if (!glyphs.has(d)) {
      const id = `glyph${glyphs.size}`;
      glyphs.set(d, id);
      const definition = document.createElementNS(root.namespaceURI, 'path');
      definition.setAttribute('id', id);
      definition.setAttribute('d', d);
      definitions.appendChild(definition);
    }
    const use = document.createElementNS(root.namespaceURI, 'use');
    use.setAttribute('href', `#${glyphs.get(d)}`);
    use.setAttribute('transform', path.getAttribute('transform'));
    path.parentNode.replaceChild(use, path);
  }
  if (glyphs.size) root.appendChild(definitions);
  return new XMLSerializer().serializeToString(document);
}
