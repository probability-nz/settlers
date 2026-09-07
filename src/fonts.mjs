import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';

async function loadFont(filename) {
  const buffer = await readFile(new URL(`./assets/fonts/${filename}`, import.meta.url));
  const bytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  return opentype.parse(bytes);
}

export async function loadFonts() {
  const [regular, bold, emoji] = await Promise.all([
    loadFont('AtkinsonHyperlegibleMono-Regular.ttf'),
    loadFont('AtkinsonHyperlegibleMono-Bold.ttf'),
    loadFont('OpenMoji-black-glyf.ttf'),
  ]);
  return { regular, bold, emoji };
}
