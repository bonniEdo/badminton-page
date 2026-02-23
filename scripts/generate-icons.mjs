import { writeFileSync } from 'fs';

const SAGE = '#8A9A5B';
const PAPER = '#FDFCF8';

function createSvg(size, padding = 0) {
  const p = padding;
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const scale = (s - p * 2) / 24;
  const tx = p;
  const ty = p;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${s * 0.18}" fill="${SAGE}"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})" fill="none" stroke="${PAPER}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="19" r="3"/>
    <line x1="12" y1="16" x2="12" y2="11"/>
    <path d="M12 11 C10 9 6.5 7 5 3"/>
    <path d="M12 11 C14 9 17.5 7 19 3"/>
    <path d="M12 11 C11 8.5 8 5 7 2.5"/>
    <path d="M12 11 C13 8.5 16 5 17 2.5"/>
    <path d="M12 11 C12 8 12 4 12 2"/>
  </g>
</svg>`;
}

function createMaskableSvg(size) {
  const safeZone = size * 0.1;
  return createSvg(size, safeZone);
}

for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.svg`, createSvg(size));
  writeFileSync(`public/icons/icon-maskable-${size}.svg`, createMaskableSvg(size));
}

console.log('SVG icons generated. Converting to PNG...');

async function svgToPng(svgPath, pngPath, size) {
  const { execSync } = await import('child_process');
  try {
    execSync(`npx --yes sharp-cli -i ${svgPath} -o ${pngPath} resize ${size} ${size}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

let usedSharp = false;
try {
  const { default: sharp } = await import('sharp');
  for (const size of [192, 512]) {
    const svgNormal = `public/icons/icon-${size}.svg`;
    const svgMask = `public/icons/icon-maskable-${size}.svg`;
    const buf1 = Buffer.from(createSvg(size));
    const buf2 = Buffer.from(createMaskableSvg(size));
    await sharp(buf1).png().toFile(`public/icons/icon-${size}.png`);
    await sharp(buf2).png().toFile(`public/icons/icon-maskable-${size}.png`);
  }
  usedSharp = true;
  console.log('PNG icons generated with sharp.');
} catch {
  console.log('sharp not available, trying resvg...');
}

if (!usedSharp) {
  try {
    const { Resvg } = await import('@aspect-dev/resvg');
    for (const size of [192, 512]) {
      const svg1 = createSvg(size);
      const svg2 = createMaskableSvg(size);
      writeFileSync(`public/icons/icon-${size}.png`, new Resvg(svg1).render().asPng());
      writeFileSync(`public/icons/icon-maskable-${size}.png`, new Resvg(svg2).render().asPng());
    }
    console.log('PNG icons generated with resvg.');
  } catch {
    console.log('No PNG converter available. Using SVG icons directly.');
    console.log('To generate PNG icons, run: npm i -D sharp && node scripts/generate-icons.mjs');
  }
}
