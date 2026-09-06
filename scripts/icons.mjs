import fs from "node:fs/promises";
import sharp from "sharp";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Map } from "lucide-react";
await fs.mkdir("public", { recursive: true });
const map = renderToStaticMarkup(
  React.createElement(Map, {
    x: 128,
    y: 128,
    width: 256,
    height: 256,
    color: "#49382D",
    strokeWidth: 1.75,
  }),
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#E9A928"/>${map}</svg>`;
await fs.writeFile("public/icon.svg", svg);
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["icon-maskable", 512],
  ["apple-touch-icon", 180],
])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/${name}.png`);
const credits=[];
for(const pkg of ['@fontsource/aoboshi-one','@fontsource/kaisei-opti','@fontsource/zen-kaku-gothic-antique','lucide-react','react','react-dom','idb','zod','jspdf','jszip']){
  const dir=`node_modules/${pkg}`;
  const names=(await fs.readdir(dir)).filter(n=>/^(LICENSE|OFL)(\.|$)/i.test(n));
  for(const name of names)credits.push(`${pkg} — ${name}\n${await fs.readFile(`${dir}/${name}`,'utf8')}`);
}
await fs.writeFile('public/third-party-licenses.txt',credits.join('\n\n--------------------\n\n'));
