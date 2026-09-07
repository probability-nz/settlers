import React, { createContext, useContext } from 'react';

export const Fonts = createContext(null);

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
  const font = fonts[emoji ? 'emoji' : bold ? 'bold' : 'regular'];
  const lines = String(children).replace(/[\uFE0E\uFE0F]/gu, '').split(/\r?\n/u);
  const options = { letterSpacing: letterSpacing / size };

  return lines.map((line, index) => {
    if (!line) return null;
    const runs = fontRuns(line, font, fonts.emoji);
    const widths = runs.map(run => run.font.getAdvanceWidth(run.text, size, options));
    const width = widths.reduce((sum, value) => sum + value, 0);
    let left = x - (align === 'middle' ? width / 2 : align === 'end' ? width : 0);
    const paths = runs.map((run, runIndex) => {
      const path = run.font.getPath(run.text, left, y + index * lineHeight, size, options);
      left += widths[runIndex];
      return path.toPathData(3);
    });
    return <path key={index} d={paths.join(' ')} fill={fill} />;
  });
}

export function Svg({ width, height, title, children }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={`${width}mm`}
      height={`${height}mm`}
      viewBox={`0 0 ${width} ${height}`}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
