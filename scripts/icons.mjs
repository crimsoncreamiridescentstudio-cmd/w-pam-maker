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

const socialMap = renderToStaticMarkup(
  React.createElement(Map, {
    x: 838,
    y: 139,
    width: 224,
    height: 224,
    color: "#49382D",
    strokeWidth: 1.75,
  }),
);
const socialPreview = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFFBF1"/>
  <circle cx="1050" cy="72" r="260" fill="#FCEFCF"/>
  <circle cx="1080" cy="570" r="190" fill="#F7D987" opacity=".5"/>
  <path d="M0 500C220 430 400 565 620 505S980 430 1200 510V630H0Z" fill="#F9E9C5"/>
  <rect x="76" y="78" width="1048" height="474" rx="34" fill="#FFFDF8" stroke="#D8C5AA" stroke-width="3"/>
  <rect x="810" y="111" width="308" height="308" rx="42" fill="#E9A928"/>
  ${socialMap}
  <text x="132" y="218" fill="#49382D" font-family="Arial, Helvetica, sans-serif" font-size="112" font-weight="700" letter-spacing="-4">W-Pam</text>
  <text x="138" y="287" fill="#7A6252" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="700" letter-spacing="5">WORLD PAMPHLET MAKER</text>
  <line x1="138" y1="334" x2="650" y2="334" stroke="#E9A928" stroke-width="8" stroke-linecap="round"/>
  <text x="138" y="407" fill="#49382D" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">Build, organize, and share your worlds.</text>
  <text x="138" y="467" fill="#7A6252" font-family="Arial, Helvetica, sans-serif" font-size="27">Local-first creative world management</text>
</svg>`;
await sharp(Buffer.from(socialPreview))
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile("public/og.png");

const credits=[];
for(const pkg of ['@fontsource/aoboshi-one','@fontsource/kaisei-opti','@fontsource/zen-kaku-gothic-antique','lucide-react','react','react-dom','idb','zod','jspdf','jszip']){
  const dir=`node_modules/${pkg}`;
  const names=(await fs.readdir(dir)).filter(n=>/^(LICENSE|OFL)(\.|$)/i.test(n));
  for(const name of names)credits.push(`${pkg} — ${name}\n${await fs.readFile(`${dir}/${name}`,'utf8')}`);
}
await fs.writeFile('public/third-party-licenses.txt',credits.join('\n\n--------------------\n\n'));
