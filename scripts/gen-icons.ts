/**
 * Renders the logo and link preview from the SVG sources in brand/ into the
 * files Next.js and browsers look for. The outputs are committed; rerun this
 * only after editing brand/mark.svg or brand/og.svg.
 *
 *   pnpm icons:gen
 *
 * og.svg uses system fonts (Helvetica Neue), so render it on macOS to get the
 * same result.
 */
import {copyFileSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const brand = (f: string) => join(root, 'brand', f);
const mark = readFileSync(brand('mark.svg'), 'utf8');
// iOS and Android mask home-screen icons themselves, so those get square corners.
const fullBleed = mark.replace('rx="112"', 'rx="0"');

const png = (svg: string, width: number, height = width) =>
  sharp(Buffer.from(svg), {density: 300}).resize(width, height).png().toBuffer();

/** An .ico holding PNG images (supported by every browser that still asks for one). */
function ico(images: {size: number; data: Buffer}[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({size, data}, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size, e);
    header.writeUInt8(size, e + 1);
    header.writeUInt16LE(1, e + 4); // color planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(i => i.data)]);
}

const out: [string, Buffer | Promise<Buffer>][] = [
  ['app/apple-icon.png', png(fullBleed, 180)],
  ['app/opengraph-image.png', png(readFileSync(brand('og.svg'), 'utf8'), 1200, 630)],
  ['public/icon-192.png', png(fullBleed, 192)],
  ['public/icon-512.png', png(fullBleed, 512)],
  ['app/favicon.ico', Promise.all([16, 32, 48].map(async size => ({size, data: await png(mark, size)}))).then(ico)],
];
for (const [path, data] of out) {
  writeFileSync(join(root, path), await data);
  console.log(`wrote ${path}`);
}
copyFileSync(brand('mark.svg'), join(root, 'app', 'icon.svg'));
console.log('wrote app/icon.svg');
