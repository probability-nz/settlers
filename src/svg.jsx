import React, { createContext, useContext } from 'react';

export const Fonts = createContext(null);
const Glyphs = createContext(null);

function Definitions() {
  const glyphs = useContext(Glyphs);
  return glyphs.size ? <defs>{Array.from(glyphs.values(), ({ id, d }) => <path key={id} id={id} d={d} />)}</defs> : null;
}

function fontRuns(text, font, emojiFont) {
  const runs = [];
  for (const character of text) {
    const selected = font.charToGlyphIndex(character) ? font : emojiFont;
    if (!/\s/u.test(character) && !selected.charToGlyphIndex(character)) {
      throw new Error(`The bundled fonts have no glyph for "${character}" in "${text}"`);
    }
    const previous = runs.at(-1);
    if (previous?.font === selected) previous.text += character;
    else runs.push({ font: selected, text: character });
  }
  return runs;
}

// Outline lettering and emoji so the exported SVG needs no installed fonts.
export function Text({
  children,
  x,
  y,
  size,
  lineHeight = size * 1.2,
  bold = false,
  emoji = false,
  fill = 'black',
  align = 'middle',
  letterSpacing = 0,
}) {
  const fonts = useContext(Fonts);
  const glyphs = useContext(Glyphs);
  const font = fonts[emoji ? 'emoji' : bold ? 'bold' : 'regular'];
  const lines = String(children).replace(/[\uFE0E\uFE0F]/gu, '').split(/\r?\n/u);
  const options = { letterSpacing: letterSpacing / size };

  return lines.map((line, index) => {
    if (!line) return null;
    const runs = fontRuns(line, font, fonts.emoji);
    const widths = runs.map(run => run.font.getAdvanceWidth(run.text, size, options));
    const width = widths.reduce((sum, value) => sum + value, 0);
    let left = x - (align === 'middle' ? width / 2 : align === 'end' ? width : 0);
    const uses = [];
    runs.forEach((run, runIndex) => {
      const fontName = Object.keys(fonts).find(name => fonts[name] === run.font);
      run.font.forEachGlyph(run.text, left, y + index * lineHeight, size, options, (glyph, gx, gy) => {
        if (!glyph.path.commands.length) return;
        const key = `${fontName}-${glyph.index}`;
        if (!glyphs.has(key)) {
          glyphs.set(key, { id: `glyph${glyphs.size}`, d: glyph.getPath(0, 0, 1).toPathData(5) });
        }
        uses.push(<use key={uses.length} href={`#${glyphs.get(key).id}`} transform={`translate(${+gx.toFixed(5)} ${+gy.toFixed(5)}) scale(${size})`} />);
      });
      left += widths[runIndex];
    });
    return <g key={index} fill={fill}>{uses}</g>;
  });
}

export function Svg({ width, height, origin = [0, 0], title, children }) {
  return (
    <Glyphs.Provider value={new Map()}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={`${width}mm`}
        height={`${height}mm`}
        viewBox={`${origin.join(' ')} ${width} ${height}`}
      >
        {title && <title>{title}</title>}
        {children}
        <Definitions />
      </svg>
    </Glyphs.Provider>
  );
}
